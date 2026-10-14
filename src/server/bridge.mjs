/**
 * bridge.mjs — ponte local do TreeOffice.
 *
 * Etapa 2 + Fase B: serve a interface, guarda o estado local e simula a
 * atividade das sessões. Com a Fase B, também lê o serviço OpenCode local
 * (somente leitura, sem criar/alterar/remover nada lá fora) quando o modo
 * real está ativo. O mock continua como caminho de teste e fallback.
 *
 * Decisões aplicadas:
 *   D40  escuta apenas em 127.0.0.1, porta padrão 4717, sem troca silenciosa
 *   D41  token de 256 bits em `.local/bridge.json`, exigido em toda requisição;
 *        requisições de escrita também validam Origin e Host
 *   D20/D22  estado em `.local/`, escrita atômica com backup e lock
 *   D25  todos os recursos são servidos localmente; nenhuma dependência de rede
 *   D46  conversa com o OpenCode por HTTP com `fetch` do Node, sem dependência
 *
 * Uso:  node src/server/bridge.mjs [--porta 4717] [--raiz DIR] [--fonte simulado|real] [--opencode-url URL]
 *   TREEOFFICE_FONTE=real|simulado  OPENCODE_SERVER_URL=http://127.0.0.1:PORTA
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  loadState,
  saveState,
  ensureLocalDir,
  localDir,
  caminhos,
  NOME_BRIDGE,
} from "./state-store.mjs";
import { normalizeState, limparOcupacaoOrfa, limparDependenciasOrfas, ESTADO } from "../shared/model.mjs";
import { seedDemoState, criarSimulacao, tickSimulacao } from "../shared/mock.mjs";
import { descobrirServico, criarClienteOpenCode } from "./opencode-client.mjs";
import { classificarEvento, detalheDoEvento, estadoDoNoReal } from "../shared/opencode-map.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_PROJETO = path.resolve(AQUI, "..", "..");
const DIR_UI = path.resolve(AQUI, "..", "ui");

const PORTA_PADRAO = 4717;
const LIMITE_CORPO = 1024 * 1024;

/**
 * Carimbo do código servido: responde "que versão estou olhando?" sem abrir
 * terminal. Identifica os fontes, não a pasta de dados (--raiz). A revisão
 * dos recursos também distingue alterações ainda não commitadas.
 */
function versaoCodigo() {
  let commit = "local";
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: RAIZ_PROJETO, encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"],
    }).trim() || "local";
  } catch {
    /* ZIP sem Git: o digest da interface continua identificando o desenho. */
  }
  const digest = crypto.createHash("sha256");
  for (const nome of ["index.html", "styles.css", "fonts.css", "app.js", "tree.js", "navigation.mjs", "connections.mjs"]) digest.update(fs.readFileSync(path.join(DIR_UI, nome)));
  return `${commit} · UI ${digest.digest("hex").slice(0, 8)}`;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
};

/*
 * O navegador busca CSS e JS como subrecursos, sem o `?token=` da URL. Sem um
 * transporte que ele carregue sozinho, a página abre e os arquivos dela são
 * recusados — sintoma de "tela em branco com botões". A ponte grava um cookie
 * HttpOnly na primeira requisição autenticada e passa a aceitá-lo como token.
 * SameSite=Strict e a validação de Origin/Host nas escritas continuam de pé.
 */
const NOME_COOKIE = "treeoffice_token";

function argumentos() {
  const args = process.argv.slice(2);
  const saida = {
    porta: PORTA_PADRAO,
    raiz: RAIZ_PROJETO,
    fonte: process.env.TREEOFFICE_FONTE === "real" ? "real" : "simulado",
    opencodeUrl: process.env.OPENCODE_SERVER_URL || null,
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--porta") saida.porta = Number.parseInt(args[++i], 10);
    if (args[i] === "--raiz") saida.raiz = path.resolve(args[++i]);
    if (args[i] === "--fonte") saida.fonte = args[++i] === "real" ? "real" : "simulado";
    if (args[i] === "--opencode-url") saida.opencodeUrl = args[++i];
  }
  if (!Number.isInteger(saida.porta) || saida.porta < 1 || saida.porta > 65535) {
    throw new Error(`Porta inválida: ${saida.porta}`);
  }
  return saida;
}

/* ── Identidade da ponte ─────────────────────────────────────────────────── */

function carregarOuCriarIdentidade(baseDir) {
  ensureLocalDir(baseDir);
  const alvo = path.join(localDir(baseDir), NOME_BRIDGE);
  try {
    const atual = JSON.parse(fs.readFileSync(alvo, "utf8"));
    if (atual && typeof atual.token === "string" && atual.token.length >= 32) {
      try {
        fs.chmodSync(alvo, 0o600);
      } catch {
        /* permissão corretiva é cortesia, não bloqueia a ponte */
      }
      return atual;
    }
  } catch {
    /* primeira execução ou arquivo inválido: recriar */
  }
  const identidade = {
    token: crypto.randomBytes(32).toString("hex"),
    criadoEm: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(alvo, `${JSON.stringify(identidade, null, 2)}\n`, { mode: 0o600 });
  } catch (erro) {
    console.error(`[treeoffice] não foi possível gravar a identidade local: ${erro.message}`);
  }
  return identidade;
}

/* ── Servidor ────────────────────────────────────────────────────────────── */

export function criarPonte(opcoes = {}) {
  const porta = opcoes.porta ?? PORTA_PADRAO;
  const baseDir = opcoes.raiz ?? RAIZ_PROJETO;
  const fonteInicial = opcoes.fonte === "real" ? "real" : "simulado";
  const opencodeUrlExplicita = opcoes.opencodeUrl || process.env.OPENCODE_SERVER_URL || null;
  const versao = versaoCodigo();

  const identidade = carregarOuCriarIdentidade(baseDir);
  const carregado = loadState(baseDir, { semear: seedDemoState });
  let state = carregado.state;
  let avisos = carregado.avisos;
  const sim = criarSimulacao(state);

  /* ── Fase B: inventário somente leitura (memória; nunca gravado) ─────────
   * `sessoes` guarda Session.Info transitórios para mapear estados. Nada
   * disso entra em state.json (D23): o estado local guarda só vínculos.
   */
  let modo = fonteInicial;
  let clienteOpenCode = null;
  const inventario = { sessoes: new Map(), projetos: [], worktrees: new Map(), atualizadoEm: 0, erro: null, versao: null };
  const vivacidade = new Map();
  let assinaturaSSE = null;
  let sseOk = false;
  let ressincEmAndamento = null;
  let reconexaoTimer = null;
  const RESSINC_MS = Number.isFinite(opcoes.ressincMs) ? opcoes.ressincMs : 60_000;
  const SSE_TENTATIVA_MS = 5000;

  function resumoOpenCode() {
    return {
      modo,
      conectado: modo === "real" && clienteOpenCode != null && !inventario.erro,
      versao: inventario.versao,
      nSessoes: inventario.sessoes.size,
      nProjetos: inventario.projetos.length,
      atualizadoEm: inventario.atualizadoEm || null,
      erro: inventario.erro,
    };
  }

  /** Uma passada de leitura completa (só GET). Lança em falha. */
  async function lerUmaVez() {
    const [info, projetos, sessoes] = await Promise.all([
      clienteOpenCode.info().catch(() => null),
      clienteOpenCode.listarProjetos().catch(() => []),
      clienteOpenCode.listarTodasSessoes({ limit: 50, maxPaginas: 20 }),
    ]);
    inventario.sessoes = new Map((sessoes || []).filter((s) => s?.id).map((s) => [s.id, s]));
    inventario.projetos = Array.isArray(projetos) ? projetos : [];
    inventario.versao = info?.version || inventario.versao;
    // Worktrees por projeto conhecido (só leitura; falhas isoladas).
    const ids = [...new Set([...inventario.projetos.map((p) => p.id), ...[...inventario.sessoes.values()].map((s) => s.projectID)])].filter(Boolean).slice(0, 30);
    const mapa = new Map();
    await Promise.all(ids.map(async (id) => {
      try {
        mapa.set(id, await clienteOpenCode.listarWorktrees(id));
      } catch { /* projeto sem worktrees: ausência não é estado */ }
    }));
    inventario.worktrees = mapa;
    inventario.atualizadoEm = Date.now();
    inventario.erro = null;
  }

  async function ressincronizar({ motivo = "manual" } = {}) {
    if (modo !== "real" || !clienteOpenCode) return resumoOpenCode();
    if (ressincEmAndamento) return ressincEmAndamento;
    ressincEmAndamento = (async () => {
      try {
        await lerUmaVez();
      } catch (primeiroErro) {
        // O serviço pode ter reiniciado em outra porta: redescobrir uma vez
        // e tentar de novo antes de declarar erro (sem iniciar nada).
        try {
          const redescoberto = descobrirServico({ url: opencodeUrlExplicita });
          if (!redescoberto.erro && redescoberto.url !== clienteOpenCode.url) {
            clienteOpenCode = criarClienteOpenCode(redescoberto);
            await lerUmaVez();
          } else {
            throw primeiroErro;
          }
        } catch (erro) {
          inventario.erro = erro?.message || primeiroErro?.message || "falha ao ler o OpenCode";
        }
      } finally {
        ressincEmAndamento = null;
      }
      // Stream caído e leitura boa de novo: re-assinar sem mexer nos nós.
      if (modo === "real" && !inventario.erro && !sseOk) void assinarSSE();
      return resumoOpenCode();
    })();
    return ressincEmAndamento;
  }

  function agendarReconexao() {
    if (reconexaoTimer) return;
    reconexaoTimer = setTimeout(() => {
      reconexaoTimer = null;
      if (modo !== "real") return;
      void ressincronizar({ motivo: "sse" });
    }, SSE_TENTATIVA_MS);
  }

  async function assinarSSE() {
    try {
      await assinaturaSSE?.fechar?.();
    } catch { /* troca de assinatura é idempotente */ }
    assinaturaSSE = null;
    sseOk = false;
    if (modo !== "real" || !clienteOpenCode) return;
    assinaturaSSE = await clienteOpenCode.assinarEventos({
      onEvento: ({ tipo, sessaoID }) => {
        if (!tipo || !sessaoID) return;
        // Vivacidade apenas; o inventário continua mandando (D33).
        vivacidade.set(sessaoID, { estado: classificarEvento(tipo), detalhe: detalheDoEvento(tipo), desde: Date.now() });
        if (vivacidade.size > 500) {
          const maisAntiga = [...vivacidade.entries()].sort((a, b) => a[1].desde - b[1].desde)[0];
          if (maisAntiga) vivacidade.delete(maisAntiga[0]);
        }
      },
      onErro: () => {
        // Queda do stream não apaga nós: releitura recompõe (D33).
        sseOk = false;
        inventario.erro = inventario.erro || "eventos interrompidos; próxima releitura recompõe";
        agendarReconexao();
      },
    });
    sseOk = assinaturaSSE?.ok !== false;
  }

  async function ativarModoReal() {
    const descoberto = descobrirServico({ url: opencodeUrlExplicita });
    if (descoberto.erro) {
      inventario.erro = descoberto.erro;
      return resumoOpenCode();
    }
    try {
      clienteOpenCode = criarClienteOpenCode(descoberto);
      modo = "real";
      await ressincronizar({ motivo: "ativar" });
      if (!inventario.erro) void assinarSSE();
      return resumoOpenCode();
    } catch (erro) {
      inventario.erro = erro?.message || "falha ao conectar";
      clienteOpenCode = null;
      modo = "simulado";
      return resumoOpenCode();
    }
  }

  async function ativarModoSimulado() {
    modo = "simulado";
    sseOk = false;
    if (reconexaoTimer) {
      clearTimeout(reconexaoTimer);
      reconexaoTimer = null;
    }
    try {
      await assinaturaSSE?.fechar?.();
    } catch { /* idempotente */ }
    assinaturaSSE = null;
    return resumoOpenCode();
  }

  // Fonte pedida na criação: tenta real sem bloquear o início; falha cai no mock.
  if (fonteInicial === "real") {
    setTimeout(() => {
      void ativarModoReal().then(() => {
        if (inventario.erro) avisos.push(`OpenCode: ${inventario.erro} (usando simulação).`);
      });
    }, 0);
  }

  if (carregado.primeiraVez) {
    try {
      saveState(baseDir, state);
    } catch (erro) {
      avisos.push(`Estado inicial não pôde ser gravado: ${erro.message}`);
    }
  }

  const timer = setInterval(() => {
    if (tickSimulacao(sim, state)) {
      /* a interface consulta /api/vivo; nada a fazer aqui */
    }
  }, 1000);

  // Releitura periódica em modo real: sem ela, o inventário envelhece e os
  // nós reais cairiam para `incerto` sem motivo (D32, D33). Só GET.
  const timerRessinc = setInterval(() => {
    if (modo === "real" && clienteOpenCode && !ressincEmAndamento) {
      void ressincronizar({ motivo: "periodica" });
    }
  }, RESSINC_MS);

  /** Mantém a simulação alinhada à árvore: nós novos entram, nós removidos saem. */
  function sincronizarSimulacao() {
    const validos = new Set(state.nos.filter((n) => n.simulado).map((n) => n.id));
    for (const id of [...sim.keys()]) {
      if (!validos.has(id)) sim.delete(id);
    }
    for (const no of state.nos) {
      if (!no.simulado || sim.has(no.id)) continue;
      sim.set(no.id, { estado: ESTADO.VAZIO, detalhe: "iniciando", desde: Date.now(), trocaEm: Date.now() + 1200 });
    }
  }
  sincronizarSimulacao();

  function cookieDaRequisicao(req) {
    const cru = req.headers.cookie || "";
    for (const parte of cru.split(";")) {
      const indice = parte.indexOf("=");
      if (indice < 0) continue;
      if (parte.slice(0, indice).trim() !== NOME_COOKIE) continue;
      try {
        return decodeURIComponent(parte.slice(indice + 1).trim());
      } catch {
        return null;
      }
    }
    return null;
  }

  function mesmoTexto(esperado, recebido) {
    const a = Buffer.from(String(esperado));
    const b = Buffer.from(String(recebido ?? ""));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  function tokenValido(req, url) {
    const cabecalho = req.headers.authorization || "";
    if (mesmoTexto(`Bearer ${identidade.token}`, cabecalho)) return true;
    if (mesmoTexto(identidade.token, cookieDaRequisicao(req))) return true;
    // Token por query só é aceito em GET, para o carregamento inicial da página.
    if (req.method === "GET" && mesmoTexto(identidade.token, url.searchParams.get("token"))) return true;
    return false;
  }

  /**
   * O cookie só é gravado quando a autenticação veio por meio explícito
   * (query ou cabeçalho), nunca em resposta a um cookie — evita reforçar
   * sessão indefinidamente e mantém o cookie curto.
   */
  function tokenExplicitoValido(req, url) {
    const cabecalho = req.headers.authorization || "";
    if (mesmoTexto(`Bearer ${identidade.token}`, cabecalho)) return true;
    if (req.method === "GET" && mesmoTexto(identidade.token, url.searchParams.get("token"))) return true;
    return false;
  }

  function gravarCookie(res) {
    res.setHeader(
      "set-cookie",
      `${NOME_COOKIE}=${encodeURIComponent(identidade.token)}; HttpOnly; SameSite=Strict; Path=/`,
    );
  }

  function origemValida(req, url) {
    const permitidos = new Set([
      `http://127.0.0.1:${porta}`,
      `http://localhost:${porta}`,
    ]);
    const host = req.headers.host;
    if (host && !permitidos.has(`http://${host}`)) return false;
    const origin = req.headers.origin;
    if (origin && !permitidos.has(origin)) return false;
    return true;
  }

  function json(res, status, corpo) {
    const corpoTexto = JSON.stringify(corpo);
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(corpoTexto);
  }

  function servirEstatico(req, res, url) {
    const pedido = url.pathname === "/" ? "/index.html" : url.pathname;
    // A interface é publicada sob /ui/; o que vem antes disso não existe.
    const relativo = pedido.startsWith("/ui/") ? pedido.slice("/ui".length) : pedido;
    const alvo = path.resolve(DIR_UI, `.${relativo}`);
    const fora = path.relative(DIR_UI, alvo);
    if (fora === ".." || fora.startsWith(`..${path.sep}`)) {
      json(res, 403, { erro: "caminho fora da interface" });
      return;
    }
    fs.readFile(alvo, (erro, dados) => {
      if (erro) {
        json(res, 404, { erro: "recurso não encontrado", caminho: pedido });
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[path.extname(alvo)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(dados);
    });
  }

  function lerCorpo(req) {
    return new Promise((resolve, reject) => {
      let total = 0;
      const pedacos = [];
      req.on("data", (pedaco) => {
        total += pedaco.length;
        if (total > LIMITE_CORPO) {
          reject(new Error("corpo da requisição grande demais"));
          req.destroy();
          return;
        }
        pedacos.push(pedaco);
      });
      req.on("end", () => {
        const texto = Buffer.concat(pedacos).toString("utf8");
        if (!texto) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(texto));
        } catch {
          reject(new Error("corpo não é JSON válido"));
        }
      });
      req.on("error", reject);
    });
  }

  async function rotas(req, res, url) {
    if (!tokenValido(req, url)) {
      json(res, 401, { erro: "token ausente ou inválido" });
      return;
    }
    // Primeira requisição autenticada da aba: o navegador passa a carregar o
    // token sozinho nos subrecursos e nas chamadas seguintes.
    if (tokenExplicitoValido(req, url)) gravarCookie(res);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/ui/"))) {
      servirEstatico(req, res, url);
      return;
    }

    if (url.pathname === "/api/saude") {
      json(res, 200, { ok: true, etapa: 2, simulado: modo === "simulado", avisos, versao, opencode: resumoOpenCode() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/estado") {
      json(res, 200, { state, simulacao: Object.fromEntries(sim), avisos, opencode: resumoOpenCode() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/vivo") {
      const vivo = {};
      const agora = Date.now();
      for (const no of state.nos) {
        if (modo === "real" && no.sessionID) {
          const real = estadoDoNoReal(no, inventario, vivacidade, agora);
          vivo[no.id] = { estado: real.estado, detalhe: real.detalhe || "", desde: real.desde || inventario.atualizadoEm || agora };
          continue;
        }
        const atual = sim.get(no.id);
        if (atual) vivo[no.id] = { estado: atual.estado, detalhe: atual.detalhe, desde: atual.desde };
      }
      json(res, 200, { vivo, opencode: resumoOpenCode() });
      return;
    }

    /* ── Fase B: leitura do OpenCode via ponte (credencial nunca no navegador) ── */

    if (req.method === "GET" && url.pathname === "/api/opencode/estado") {
      json(res, 200, resumoOpenCode());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/opencode/sessoes") {
      if (modo !== "real" || !clienteOpenCode) {
        json(res, 409, { erro: "modo simulado ativo; ative os dados reais primeiro" });
        return;
      }
      try {
        const resposta = await clienteOpenCode.listarSessoes({
          limit: Math.min(Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100),
          cursor: url.searchParams.get("cursor") || undefined,
          directory: url.searchParams.get("directory") || undefined,
          project: url.searchParams.get("project") || undefined,
          search: url.searchParams.get("search") || undefined,
        });
        json(res, 200, resposta);
      } catch (erro) {
        json(res, 502, { erro: erro?.message || "falha ao ler sessões" });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/opencode/projetos") {
      if (modo !== "real" || !clienteOpenCode) {
        json(res, 409, { erro: "modo simulado ativo; ative os dados reais primeiro" });
        return;
      }
      try {
        json(res, 200, { data: await clienteOpenCode.listarProjetos() });
      } catch (erro) {
        json(res, 502, { erro: erro?.message || "falha ao ler projetos" });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/opencode/worktrees") {
      if (modo !== "real" || !clienteOpenCode) {
        json(res, 409, { erro: "modo simulado ativo; ative os dados reais primeiro" });
        return;
      }
      const projectID = url.searchParams.get("projectID") || "";
      if (!projectID) {
        json(res, 400, { erro: "projectID é obrigatório" });
        return;
      }
      try {
        json(res, 200, { data: await clienteOpenCode.listarWorktrees(projectID) });
      } catch (erro) {
        json(res, 502, { erro: erro?.message || "falha ao ler worktrees" });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/opencode/ressincronizar") {
      if (!origemValida(req, url)) {
        json(res, 403, { erro: "origem ou host não autorizado" });
        return;
      }
      if (modo !== "real" || !clienteOpenCode) {
        json(res, 409, { erro: "modo simulado ativo; ative os dados reais primeiro" });
        return;
      }
      json(res, 200, await ressincronizar({ motivo: "manual" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/opencode/modo") {
      if (!origemValida(req, url)) {
        json(res, 403, { erro: "origem ou host não autorizado" });
        return;
      }
      let corpo;
      try {
        corpo = await lerCorpo(req);
      } catch (erro) {
        json(res, 400, { erro: erro.message });
        return;
      }
      if (corpo?.modo === "real") {
        json(res, 200, await ativarModoReal());
        return;
      }
      json(res, 200, await ativarModoSimulado());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/estado") {
      if (!origemValida(req, url)) {
        json(res, 403, { erro: "origem ou host não autorizado" });
        return;
      }
      let corpo;
      try {
        corpo = await lerCorpo(req);
      } catch (erro) {
        json(res, 400, { erro: erro.message });
        return;
      }
      const normalizado = normalizeState(corpo?.state ?? corpo);
      limparOcupacaoOrfa(normalizado.state);
      limparDependenciasOrfas(normalizado.state);
      try {
        const info = saveState(baseDir, normalizado.state);
        state = normalizado.state;
        sincronizarSimulacao();
        avisos = normalizado.avisos;
        if (info.lockVelho) avisos.push("Um lock de escrita velho foi assumido por esta instância.");
        json(res, 200, {
          ok: true,
          gravado: info.caminho,
          backup: info.backup,
          avisos: normalizado.avisos,
          simulacao: Object.fromEntries(sim),
        });
      } catch (erro) {
        const status = erro.code === "LOCKED" ? 409 : 500;
        json(res, status, { erro: erro.message });
      }
      return;
    }

    json(res, 404, { erro: "rota não encontrada", rota: url.pathname });
  }

  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${porta}`);
    Promise.resolve(rotas(req, res, url)).catch((erro) => {
      json(res, 500, { erro: erro?.message ?? "erro interno" });
    });
  });

  function iniciar() {
    return new Promise((resolve, reject) => {
      servidor.once("error", (erro) => {
        if (erro.code === "EADDRINUSE") {
          const detalhado = new Error(
            `A porta ${porta} já está em uso. O painel não inicia em outra porta sem sua autorização (D40).`,
          );
          detalhado.code = "EADDRINUSE";
          reject(detalhado);
          return;
        }
        reject(erro);
      });
      // Escuta exclusivamente no retorno loopback.
      servidor.listen(porta, "127.0.0.1", () => resolve(servidor));
    });
  }

  async function parar() {
    clearInterval(timer);
    clearInterval(timerRessinc);
    if (reconexaoTimer) {
      clearTimeout(reconexaoTimer);
      reconexaoTimer = null;
    }
    try {
      await assinaturaSSE?.fechar?.();
    } catch { /* idempotente */ }
    assinaturaSSE = null;
    sseOk = false;
    // Conexões keep-alive do cliente não devem segurar o encerramento.
    servidor.closeAllConnections?.();
    return new Promise((resolve) => servidor.close(() => resolve()));
  }

  return {
    iniciar,
    parar,
    porta,
    baseDir,
    identidade: () => identidade,
    estadoAtual: () => state,
    avisos: () => avisos,
    simulacao: () => Object.fromEntries(sim),
    versao: () => versao,
    opencode: () => resumoOpenCode(),
    ativarModoReal,
    ativarModoSimulado,
    ressincronizar,
  };
}

/* ── Execução direta ─────────────────────────────────────────────────────── */

const executandoDiretamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executandoDiretamente) {
  const { porta, raiz, fonte, opencodeUrl } = argumentos();
  const ponte = criarPonte({ porta, raiz, fonte, opencodeUrl });
  ponte
    .iniciar()
    .then(() => {
      const caminho = caminhos(raiz);
      console.log("");
      console.log(`TreeOffice — ponte (fonte inicial: ${fonte})`);
      console.log(`  Ponte   http://127.0.0.1:${ponte.porta}/?token=${ponte.identidade().token}`);
      console.log(`  Estado  ${caminho.estado}`);
      console.log("  Fase B: somente leitura do OpenCode quando em modo real; nada é criado lá fora.");
      console.log("  Ctrl+C para encerrar.");
      console.log("");
      if (ponte.avisos().length) {
        console.log("  Avisos:");
        for (const aviso of ponte.avisos()) console.log(`   - ${aviso}`);
        console.log("");
      }
    })
    .catch((erro) => {
      console.error(`[treeoffice] falha ao iniciar: ${erro.message}`);
      process.exitCode = 1;
    });

  const encerrar = async () => {
    console.log("\n[treeoffice] encerrando ponte…");
    await ponte.parar();
    process.exit(0);
  };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
}

export { PORTA_PADRAO, NOME_COOKIE, ESTADO };
