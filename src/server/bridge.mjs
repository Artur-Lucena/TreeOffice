/**
 * bridge.mjs — ponte local do TreeOffice.
 *
 * Etapa 2: serve a interface, guarda o estado local e simula a atividade das
 * sessões. Não há nenhuma chamada ao OpenCode nesta etapa.
 *
 * Decisões aplicadas:
 *   D40  escuta apenas em 127.0.0.1, porta padrão 4717, sem troca silenciosa
 *   D41  token de 256 bits em `.local/bridge.json`, exigido em toda requisição;
 *        requisições de escrita também validam Origin e Host
 *   D20/D22  estado em `.local/`, escrita atômica com backup e lock
 *   D25  todos os recursos são servidos localmente; nenhuma dependência de rede
 *
 * Uso:  node src/server/bridge.mjs [--porta 4717] [--raiz DIR]
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_PROJETO = path.resolve(AQUI, "..", "..");
const DIR_UI = path.resolve(AQUI, "..", "ui");

const PORTA_PADRAO = 4717;
const LIMITE_CORPO = 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function argumentos() {
  const args = process.argv.slice(2);
  const saida = { porta: PORTA_PADRAO, raiz: RAIZ_PROJETO };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--porta") saida.porta = Number.parseInt(args[++i], 10);
    if (args[i] === "--raiz") saida.raiz = path.resolve(args[++i]);
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
    if (atual && typeof atual.token === "string" && atual.token.length >= 32) return atual;
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

  const identidade = carregarOuCriarIdentidade(baseDir);
  const carregado = loadState(baseDir, { semear: seedDemoState });
  let state = carregado.state;
  let avisos = carregado.avisos;
  const sim = criarSimulacao(state);

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

  function tokenValido(req, url) {
    const cabecalho = req.headers.authorization || "";
    if (cabecalho === `Bearer ${identidade.token}`) return true;
    // Token por query só é aceito em GET, para o carregamento inicial da página.
    if (req.method === "GET" && url.searchParams.get("token") === identidade.token) return true;
    return false;
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
    if (!alvo.startsWith(DIR_UI)) {
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

    if (req.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/ui/"))) {
      servirEstatico(req, res, url);
      return;
    }

    if (url.pathname === "/api/saude") {
      json(res, 200, { ok: true, etapa: 2, simulado: true, avisos });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/estado") {
      json(res, 200, { state, simulacao: Object.fromEntries(sim), avisos });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/vivo") {
      const vivo = {};
      for (const no of state.nos) {
        const atual = sim.get(no.id);
        if (atual) vivo[no.id] = { estado: atual.estado, detalhe: atual.detalhe, desde: atual.desde };
      }
      json(res, 200, { vivo });
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

  function parar() {
    clearInterval(timer);
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
  };
}

/* ── Execução direta ─────────────────────────────────────────────────────── */

const executandoDiretamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executandoDiretamente) {
  const { porta, raiz } = argumentos();
  const ponte = criarPonte({ porta, raiz });
  ponte
    .iniciar()
    .then(() => {
      const caminho = caminhos(raiz);
      console.log("");
      console.log("TreeOffice — protótipo (Etapa 2, dados simulados)");
      console.log(`  Ponte   http://127.0.0.1:${ponte.porta}/?token=${ponte.identidade().token}`);
      console.log(`  Estado  ${caminho.estado}`);
      console.log("  Nenhuma integração com o OpenCode nesta etapa.");
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

export { PORTA_PADRAO, ESTADO };
