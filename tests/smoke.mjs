/**
 * smoke.mjs — verificação do protótipo com dados simulados.
 *
 * Nada aqui toca em projetos, chats, worktrees, vault ou no OpenCode. O teste
 * cria diretórios temporários descartáveis e exercita a ponte e o armazenamento
 * local (D20, D22, D23, D40, D41).
 *
 * Uso:  node tests/smoke.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

import { criarPonte, NOME_COOKIE } from "../src/server/bridge.mjs";
import { normalizeState, emptyState, ESTADO } from "../src/shared/model.mjs";
import { loadState, localDir, NOME_ESTADO } from "../src/server/state-store.mjs";

let passou = 0;
let falhou = 0;
const falhas = [];

function verificar(nome, condicao, detalhe = "") {
  if (condicao) {
    passou += 1;
    console.log(`  ok   ${nome}`);
  } else {
    falhou += 1;
    falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ""}`);
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

function temporario(rotulo) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `treeoffice-${rotulo}-`));
}

async function pedir(porta, caminho, opcoes = {}) {
  const url = `http://127.0.0.1:${porta}${caminho}`;
  const resposta = await fetch(url, {
    method: opcoes.method || "GET",
    headers: opcoes.headers || {},
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
    redirect: "manual",
  });
  const texto = await resposta.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* resposta não é JSON */
  }
  return { status: resposta.status, corpo: json, texto };
}

/**
 * Requisição HTTP crua: o `fetch` do Node proíbe forjar alguns cabeçalhos
 * (entre eles `Host`), então a validação de host precisa de socket direto.
 */
function pedirCru(porta, linhas) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(porta, "127.0.0.1", () => {
      socket.write(`${linhas.join("\r\n")}\r\n\r\n`);
    });
    let dados = "";
    socket.setTimeout(5000);
    socket.on("data", (pedaco) => {
      dados += pedaco.toString();
    });
    socket.on("end", () => {
      const status = Number.parseInt(dados.split(" ")[1] || "0", 10);
      resolve({ status, texto: dados });
    });
    socket.on("timeout", () => socket.destroy());
    socket.on("error", reject);
  });
}

const PORTA = Number.parseInt(process.env.TREEOFFICE_TEST_PORT || "47181", 10);

async function main() {
  const raiz = temporario("raiz");
  console.log(`\nTreeOffice — teste de fumaça (Etapa 2, dados simulados)\nRaiz descartável: ${raiz}\n`);

  const ponte = criarPonte({ porta: PORTA, raiz });
  await ponte.iniciar();
  const token = ponte.identidade().token;
  const com = { authorization: `Bearer ${token}` };
  const jsonCom = { ...com, "content-type": "application/json" };

  try {
    /* ── Autenticação ──────────────────────────────────────────────────── */
    console.log("Autenticação e exposição");
    const semToken = await pedir(PORTA, "/api/saude");
    verificar("requisição sem token é recusada (401)", semToken.status === 401, `status ${semToken.status}`);

    const tokenRuim = await pedir(PORTA, "/api/saude", { headers: { authorization: "Bearer errado" } });
    verificar("token inválido é recusado (401)", tokenRuim.status === 401, `status ${tokenRuim.status}`);

    const tokenNaQuery = await pedir(PORTA, `/api/saude?token=${token}`);
    verificar("token por query é aceito em GET (carregamento da página)", tokenNaQuery.status === 200);

    const postComTokenNaQuery = await pedir(PORTA, "/api/estado?token=" + token, {
      method: "POST",
      corpo: { state: emptyState() },
    });
    verificar(
      "POST com token apenas na query é recusado (401)",
      postComTokenNaQuery.status === 401,
      `status ${postComTokenNaQuery.status}`,
    );

    const saude = await pedir(PORTA, "/api/saude", { headers: com });
    verificar("token válido acessa a API", saude.status === 200 && saude.corpo?.simulado === true);
    verificar("saúde declara a etapa 2 como simulada", saude.corpo?.etapa === 2);

    /* ── Cookie de subrecursos ────────────────────────────────────────── */
    // O navegador busca CSS e JS como subrecursos, sem o `?token=` da URL.
    // Sem um transporte que ele carregue sozinho, a página abre e os arquivos
    // dela são recusados — sintoma de "tela em branco com botões". A ponte
    // grava um cookie HttpOnly na primeira requisição autenticada e passa a
    // aceitá-lo como token. SameSite=Strict e a validação de Origin/Host nas
    // escritas continuam de pé.
    console.log("\nCookie de subrecursos (D41)");
    const respostaComCookie = await fetch(`http://127.0.0.1:${PORTA}/api/saude?token=${token}`, {
      redirect: "manual",
    });
    const setCookie = respostaComCookie.headers.get("set-cookie") || "";
    verificar(
      "primeira requisição autenticada grava cookie do token",
      respostaComCookie.status === 200 && setCookie.includes(`${NOME_COOKIE}=${token}`),
      setCookie,
    );
    verificar(
      "cookie é HttpOnly, SameSite=Strict e com Path=/",
      /HttpOnly/i.test(setCookie) && /SameSite=Strict/i.test(setCookie) && /Path=\//i.test(setCookie),
      setCookie,
    );

    const soCookie = { cookie: `${NOME_COOKIE}=${token}` };
    const getComCookie = await pedir(PORTA, "/api/saude", { headers: soCookie });
    verificar(
      "GET apenas com cookie é aceito (subrecursos da página)",
      getComCookie.status === 200,
      `status ${getComCookie.status}`,
    );

    const postComCookie = await pedir(PORTA, "/api/estado", {
      method: "POST",
      headers: { ...soCookie, origin: `http://127.0.0.1:${PORTA}` },
      corpo: { state: emptyState() },
    });
    verificar(
      "POST com cookie e origem legítima é aceito",
      postComCookie.status === 200,
      `status ${postComCookie.status}`,
    );

    const postComCookieOrigemRuim = await pedir(PORTA, "/api/estado", {
      method: "POST",
      headers: { ...soCookie, origin: "http://inimigo.example" },
      corpo: { state: emptyState() },
    });
    verificar(
      "POST com cookie e origem estranha é recusado (403)",
      postComCookieOrigemRuim.status === 403,
      `status ${postComCookieOrigemRuim.status}`,
    );

    const cookieNaoRenova = await fetch(`http://127.0.0.1:${PORTA}/api/saude`, {
      headers: soCookie,
      redirect: "manual",
    });
    verificar(
      "requisição apenas com cookie não regrava cookie (sem renovação indefinida)",
      !(cookieNaoRenova.headers.get("set-cookie") || "").includes(NOME_COOKIE),
    );

    /* ── Simulação ─────────────────────────────────────────────────────── */
    // Feita antes de qualquer POST, para observar o estado semeado de origem.
    console.log("\nSimulação");
    const estadoApi = await pedir(PORTA, "/api/estado", { headers: com });
    verificar("estado inicial semeia árvore de demonstração", (estadoApi.corpo?.state?.nos?.length ?? 0) > 0);
    verificar(
      "estado semeado usa caminhos simulados",
      JSON.stringify(estadoApi.corpo?.state?.cadastros || []).includes("/simulado/"),
    );
    verificar("simulação é entregue sem ser persistida", estadoApi.corpo?.simulacao != null);

    const vivo1 = await pedir(PORTA, "/api/vivo", { headers: com });
    await new Promise((r) => setTimeout(r, 2300));
    const vivo2 = await pedir(PORTA, "/api/vivo", { headers: com });
    const mudou = JSON.stringify(vivo1.corpo?.vivo || {}) !== JSON.stringify(vivo2.corpo?.vivo || {});
    verificar("estados simulados evoluem com o tempo", mudou);

    /* ── Origem e host ─────────────────────────────────────────────────── */
    console.log("\nValidação de origem (D41)");
    const origemRuim = await pedir(PORTA, "/api/estado", {
      method: "POST",
      headers: { ...jsonCom, origin: "http://inimigo.example" },
      corpo: { state: emptyState() },
    });
    verificar("Origin estranha é recusada (403)", origemRuim.status === 403, `status ${origemRuim.status}`);

    const hostRuim = await pedirCru(PORTA, [
      `POST /api/estado HTTP/1.1`,
      `Host: inimigo.example:${PORTA}`,
      `Authorization: Bearer ${token}`,
      `Content-Type: application/json`,
      `Content-Length: 2`,
      `Connection: close`,
    ]);
    verificar("Host estranho é recusado (403)", hostRuim.status === 403, `status ${hostRuim.status}`);

    const origemBoa = await pedir(PORTA, "/api/estado", {
      method: "POST",
      headers: { ...jsonCom, origin: `http://127.0.0.1:${PORTA}` },
      corpo: { state: emptyState() },
    });
    verificar("Origin legítima é aceita", origemBoa.status === 200, `status ${origemBoa.status}`);

    /* ── Recursos estáticos ────────────────────────────────────────────── */
    console.log("\nRecursos locais (D25)");
    const pagina = await pedir(PORTA, "/", { headers: com });
    verificar("página inicial é servida", pagina.status === 200 && pagina.texto.includes("TreeOffice"));

    const arvoreJs = await pedir(PORTA, "/ui/tree.js", { headers: com });
    verificar(
      "renderizador é servido localmente",
      arvoreJs.status === 200 && arvoreJs.texto.includes("criarArvore"),
      `status ${arvoreJs.status}`,
    );

    const css = await pedir(PORTA, "/ui/styles.css", { headers: com });
    verificar("estilo é servido localmente", css.status === 200 && css.texto.includes("TreeOffice"));

    const appJs = await pedir(PORTA, "/ui/app.js", { headers: com });
    verificar("lógica da interface é servida localmente", appJs.status === 200 && appJs.texto.includes("criarArvore"));

    const tentativaFuga = await pedir(PORTA, "/ui/..%2f..%2fpackage.json", { headers: com });
    verificar(
      "tentativa de fuga de diretório não retorna arquivo externo",
      tentativaFuga.status === 404 || !tentativaFuga.texto.includes("treeoffice"),
    );

    const inexistente = await pedir(PORTA, "/ui/nao-existe.js", { headers: com });
    verificar("recurso inexistente devolve 404", inexistente.status === 404);

    /* ── Normalização e privacidade ────────────────────────────────────── */
    console.log("\nContrato de estado (D20, D21, D23)");
    const sujo = emptyState();
    sujo.nos = [
      { id: "n_ok", titulo: "Válido" },
      { titulo: "Sem identificador" },
      { id: "n_privado", titulo: "Com segredo", conversa: "conteúdo privado", notaDoVault: "x" },
    ];
    sujo.dependencias = [{ origem: "n_ok", destino: "n_fantasma" }];
    const normalizado = normalizeState(sujo);
    verificar("nó sem identificador é descartado", normalizado.state.nos.length === 2);
    verificar("aresta órfã é descartada", normalizado.state.dependencias.length === 0);
    verificar("avisos são produzidos", normalizado.avisos.length >= 2, `${normalizado.avisos.length} avisos`);

    const escrito = JSON.stringify(normalizado.state);
    verificar("conteúdo privado não é persistido", !escrito.includes("conteúdo privado"));
    verificar("notas do vault não são persistidas", !escrito.includes("notaDoVault"));

    /* ── Persistência atômica e backup ─────────────────────────────────── */
    console.log("\nPersistência (D20, D22)");
    const base = emptyState();
    base.nos = [{ id: "n_a", titulo: "A", simulado: false, estado: ESTADO.DORMENTE }];
    await pedir(PORTA, "/api/estado", { method: "POST", headers: jsonCom, corpo: { state: base } });
    const arquivo = path.join(localDir(raiz), NOME_ESTADO);
    verificar("estado é gravado em .local/", fs.existsSync(arquivo));

    base.nos.push({ id: "n_b", titulo: "B", simulado: false, estado: ESTADO.ATIVO });
    await pedir(PORTA, "/api/estado", { method: "POST", headers: jsonCom, corpo: { state: base } });
    const segunda = fs.readFileSync(arquivo, "utf8");
    verificar("segunda gravação substitui o estado", segunda.includes("n_b"));
    verificar(
      "nenhum arquivo temporário fica para trás",
      !fs.readdirSync(localDir(raiz)).some((f) => f.endsWith(".tmp")),
    );
    const backup = path.join(localDir(raiz), "state.backup.json");
    const backupTexto = fs.existsSync(backup) ? fs.readFileSync(backup, "utf8") : "";
    verificar("backup da versão anterior é mantido", backupTexto.includes("n_a"));
    verificar("backup contém a versão anterior, não a atual", backupTexto !== segunda);

    /* ── Nó criado no painel entra na simulação ────────────────────────── */
    const comNovoNo = emptyState();
    comNovoNo.nos = [{ id: "n_novo", titulo: "Novo", simulado: true, estado: ESTADO.VAZIO }];
    await pedir(PORTA, "/api/estado", { method: "POST", headers: jsonCom, corpo: { state: comNovoNo } });
    await new Promise((r) => setTimeout(r, 1500));
    const vivoNovo = await pedir(PORTA, "/api/vivo", { headers: com });
    verificar("nó simulado criado depois entra na simulação", vivoNovo.corpo?.vivo?.n_novo != null);

    /* ── Lock ──────────────────────────────────────────────────────────── */
    console.log("\nLock de escrita (D22)");
    const caminhoLock = path.join(localDir(raiz), "state.lock");
    fs.writeFileSync(
      caminhoLock,
      JSON.stringify({ pid: 999999, maquina: "teste", criadoEm: new Date().toISOString() }),
    );
    const bloqueado = await pedir(PORTA, "/api/estado", { method: "POST", headers: jsonCom, corpo: { state: base } });
    verificar("lock fresco bloqueia a escrita (409)", bloqueado.status === 409, `status ${bloqueado.status}`);
    verificar("mensagem de lock é compreensível", /outra grava|lock/i.test(bloqueado.corpo?.erro || ""));

    fs.writeFileSync(
      caminhoLock,
      JSON.stringify({ pid: 999999, maquina: "teste", criadoEm: new Date(Date.now() - 600_000).toISOString() }),
    );
    const lockVelho = await pedir(PORTA, "/api/estado", { method: "POST", headers: jsonCom, corpo: { state: base } });
    verificar("lock velho é assumido e a escrita prossegue", lockVelho.status === 200, `status ${lockVelho.status}`);
    verificar("lock velho é reportado como aviso", (lockVelho.corpo?.avisos || []).some((a) => /lock/i.test(a)));

    /* ── Arquivo corrompido ────────────────────────────────────────────── */
    console.log("\nModo degradado (D22)");
    fs.writeFileSync(arquivo, '{"schemaVersion": 1, "nos": [{"id": "n_x", "titu', "utf8");
    const recarregado = loadState(raiz);
    verificar(
      "estado corrompido recai no backup",
      recarregado.state.nos.some((n) => n.id === "n_a") || recarregado.state.nos.some((n) => n.id === "n_novo"),
    );
    verificar("modo degradado emite aviso", recarregado.degradado === true && recarregado.avisos.length > 0);

    /* ── Porta ocupada ─────────────────────────────────────────────────── */
    console.log("\nPorta (D40)");
    let erroPorta = null;
    try {
      const outra = criarPonte({ porta: PORTA, raiz });
      await outra.iniciar();
      await outra.parar();
    } catch (erro) {
      erroPorta = erro;
    }
    verificar("porta ocupada impede início silencioso", erroPorta?.code === "EADDRINUSE", erroPorta?.message);
    verificar("ponte rodando na porta esperada", ponte.porta === PORTA);
  } finally {
    await ponte.parar();
  }

  console.log(`\nResultado: ${passou} ok, ${falhou} falha${falhou === 1 ? "" : "s"}.`);
  if (falhou) {
    console.log("\nFalhas:");
    for (const f of falhas) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
  console.log("\nNenhum projeto real, chat, worktree, vault ou OpenCode foi tocado.");
}

main().catch((erro) => {
  console.error(`\nErro inesperado no teste: ${erro?.stack || erro}`);
  process.exitCode = 1;
});
