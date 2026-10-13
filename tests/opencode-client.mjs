/**
 * opencode-client.mjs — Fase B com serviço simulado.
 *
 * Nada aqui toca no OpenCode real, em projetos ou no vault. Um servidor falso
 * de loopback simula `/api/info`, `/api/project`, `/api/session` paginado,
 * `/api/worktree` e `/api/event`. A descoberta usa HOME temporário.
 *
 * Uso:  node tests/opencode-client.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

import { criarPonte } from "../src/server/bridge.mjs";
import { descobrirServico, criarClienteOpenCode } from "../src/server/opencode-client.mjs";
import {
  mapearEstadoSessao,
  classificarEvento,
  detalheDoEvento,
  estadoDoNoReal,
} from "../src/shared/opencode-map.mjs";
import { ESTADO, emptyState } from "../src/shared/model.mjs";
import { localDir } from "../src/server/state-store.mjs";

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

const SENHA_FALSA = "fake-password-para-teste-123";
const SESSOES_FALSAS = [
  { id: "ses_a", projectID: "proj_a", title: "Alfa", outcome: null, time: { created: 1, updated: Date.now(), idle: Date.now() }, location: { directory: "/fake/a" } },
  { id: "ses_b", projectID: "proj_a", title: "Bravo", outcome: "succeeded", time: { created: 1, updated: Date.now() - 10_000_000, idle: Date.now() - 10_000_000 }, location: { directory: "/fake/a" } },
  { id: "ses_c", projectID: "proj_b", title: "Charlie", outcome: "failed", time: { created: 1, updated: Date.now() - 20_000_000, idle: Date.now() - 20_000_000 }, location: { directory: "/fake/b" } },
  { id: "ses_d", projectID: "proj_b", title: "Delta", outcome: null, time: { created: 1, updated: Date.now(), idle: Date.now() }, location: { directory: "/fake/b" } },
  { id: "ses_e", projectID: "proj_a", title: "Echo", outcome: "interrupted", time: { created: 1, updated: Date.now() - 30_000_000, idle: Date.now() - 30_000_000 }, location: { directory: "/fake/a" } },
];
const PROJETOS_FALSOS = [
  { id: "proj_a", canonical: "/fake/a" },
  { id: "proj_b", canonical: "/fake/b" },
];

function authOk(req) {
  const esperado = `Basic ${Buffer.from(`opencode:${SENHA_FALSA}`, "utf8").toString("base64")}`;
  return req.headers.authorization === esperado;
}

function criarFalso() {
  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (!authOk(req)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ erro: "não autorizado" }));
      return;
    }
    if (url.pathname === "/api/info") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ version: "9.9.9-test", urls: [] }));
      return;
    }
    if (url.pathname === "/api/project") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(PROJETOS_FALSOS));
      return;
    }
    if (url.pathname === "/api/session") {
      const limit = Math.min(Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100);
      const inicio = Number.parseInt(url.searchParams.get("cursor") || "0", 10) || 0;
      const fatia = SESSOES_FALSAS.slice(inicio, inicio + limit);
      const next = inicio + limit < SESSOES_FALSAS.length ? String(inicio + limit) : null;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: fatia, cursor: { previous: null, next } }));
      return;
    }
    if (url.pathname === "/api/worktree") {
      const projectID = url.searchParams.get("projectID") || "";
      if (!projectID) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ erro: "projectID obrigatório" }));
        return;
      }
      const dados = projectID === "proj_a" ? [{ directory: "/fake/a/wt/1" }] : [];
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(dados));
      return;
    }
    if (url.pathname === "/api/event") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
      res.write(`data: ${JSON.stringify({ id: "evt_1", type: "session.step.started", data: { sessionID: "ses_a" } })}\n\n`);
      res.write(`data: ${JSON.stringify({ id: "evt_2", type: "permission.asked", data: { sessionID: "ses_d" } })}\n\n`);
      setTimeout(() => res.end(), 100);
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ erro: "não encontrado" }));
  });
  return new Promise((resolve) => servidor.listen(0, "127.0.0.1", () => resolve(servidor)));
}

async function pedir(porta, caminho, opcoes = {}) {
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, {
    method: opcoes.method || "GET",
    headers: opcoes.headers || {},
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
    redirect: "manual",
  });
  const texto = await resposta.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch { /* nem toda resposta é JSON */ }
  return { status: resposta.status, corpo: json, texto };
}

const PORTA = Number.parseInt(process.env.TREEOFFICE_TEST_PORT2 || "47182", 10);

async function main() {
  console.log("\nTreeOffice — Fase B com serviço simulado\n");
  const falso = await criarFalso();
  const urlFalsa = `http://127.0.0.1:${falso.address().port}`;

  const casaAntiga = process.env.HOME;
  const xdgAntigo = process.env.XDG_STATE_HOME;
  const casaFalsa = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-casa-"));
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-faseb-"));
  process.env.HOME = casaFalsa;
  process.env.XDG_STATE_HOME = path.join(casaFalsa, ".local", "state");
  fs.mkdirSync(path.join(casaFalsa, ".config", "opencode"), { recursive: true });
  fs.writeFileSync(path.join(casaFalsa, ".config", "opencode", "service.json"), JSON.stringify({ password: SENHA_FALSA }));

  const ponte = criarPonte({ porta: PORTA, raiz, opencodeUrl: urlFalsa });
  await ponte.iniciar();
  const token = ponte.identidade().token;
  const com = { authorization: `Bearer ${token}` };
  const jsonCom = { ...com, "content-type": "application/json", origin: `http://127.0.0.1:${PORTA}` };

  try {
    /* ── Descoberta e cliente ─────────────────────────────────────────── */
    console.log("Descoberta e autenticação");
    const semUrl = descobrirServico({ casa: fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-vazia-")) });
    verificar("sem serviço descoberto há erro, sem exceção", !!semUrl.erro);

    const achado = descobrirServico({ url: urlFalsa });
    verificar("URL explícita + senha-descoberta", achado.url === urlFalsa && achado.password === SENHA_FALSA);

    const cliente = criarClienteOpenCode(achado);
    const negado = await fetch(`${urlFalsa}/api/project`).then((r) => r.status);
    verificar("falso exige autenticação (401 sem credencial)", negado === 401);

    const todas = await cliente.listarTodasSessoes({ limit: 2, maxPaginas: 10 });
    verificar("paginação por cursor percorre tudo", todas.length === 5, `${todas.length} sessões`);

    const projetos = await cliente.listarProjetos();
    verificar("projetos listados", projetos.length === 2);

    let worktreeSemIdFalhou = false;
    try {
      await cliente.listarWorktrees("");
    } catch {
      worktreeSemIdFalhou = true;
    }
    verificar("worktree sem projectID é recusado", worktreeSemIdFalhou);
    const wt = await cliente.listarWorktrees("proj_a");
    verificar("worktrees por projeto", Array.isArray(wt) && wt.length === 1 && wt[0].directory === "/fake/a/wt/1");

    const eventos = [];
    await cliente.assinarEventos({ onEvento: (e) => eventos.push(e) });
    await new Promise((r) => setTimeout(r, 400));
    verificar("SSE entrega eventos com sessionID", eventos.some((e) => e.sessaoID === "ses_a"));

    /* ── Mapeamento puro ──────────────────────────────────────────────── */
    console.log("\nMapeamento de estados");
    verificar("outcome nulo é ativo", mapearEstadoSessao(SESSOES_FALSAS[0]) === ESTADO.ATIVO);
    verificar("succeeded antigo é dormente", mapearEstadoSessao(SESSOES_FALSAS[1]) === ESTADO.DORMENTE);
    verificar("evento de permissão pede atenção", classificarEvento("permission.asked") === ESTADO.ATIVO);
    verificar("detalhe de permissão é legível", detalheDoEvento("permission.asked") === "aguardando permissão");

    const inv = { sessoes: new Map(SESSOES_FALSAS.map((s) => [s.id, s])), atualizadoEm: Date.now(), erro: null };
    verificar("nó sem sessão é vazio", estadoDoNoReal({ sessionID: null }, inv, new Map()).estado === ESTADO.VAZIO);
    verificar("sessão ausente não some", estadoDoNoReal({ sessionID: "ses_x" }, inv, new Map()).estado === ESTADO.NAO_ENCONTRADO);
    verificar(
      "inventário com erro vira incerto",
      estadoDoNoReal({ sessionID: "ses_a" }, { ...inv, erro: "queda" }, new Map()).estado === ESTADO.INCERTO,
    );

    /* ── Ponte em modo real ───────────────────────────────────────────── */
    console.log("\nPonte em modo real (falso)");
    const saudeAntes = await pedir(PORTA, "/api/saude", { headers: com });
    verificar("ponte nasce em simulado", saudeAntes.corpo?.simulado === true && saudeAntes.corpo?.opencode?.modo === "simulado");

    const modo = await pedir(PORTA, "/api/opencode/modo", { method: "POST", headers: jsonCom, corpo: { modo: "real" } });
    verificar("ativar modo real conecta", modo.corpo?.modo === "real" && modo.corpo?.conectado === true, JSON.stringify(modo.corpo));
    verificar("inventário conta sessões e projetos", modo.corpo?.nSessoes === 5 && modo.corpo?.nProjetos === 2);

    const pagina = await pedir(PORTA, "/api/opencode/sessoes?limit=2", { headers: com });
    verificar("ponte pagina sessões sem expor credencial", pagina.corpo?.data?.length === 2 && !pagina.texto.includes(SENHA_FALSA));

    const estadoOpencode = await pedir(PORTA, "/api/opencode/estado", { headers: com });
    verificar("estado não vaza credencial", !estadoOpencode.texto.includes(SENHA_FALSA));

    // Nó real + nó fantasma: releitura nunca remove nó (D21, D33).
    const base = emptyState();
    base.nos = [
      { id: "n_real", titulo: "Nó real", simulado: false, estado: "vazio", sessionID: "ses_a" },
      { id: "n_fantasma", titulo: "Nó fantasma", simulado: false, estado: "vazio", sessionID: "ses_x" },
    ];
    await pedir(PORTA, "/api/estado", { method: "POST", headers: jsonCom, corpo: { state: base } });
    const vivo = await pedir(PORTA, "/api/vivo", { headers: com });
    verificar("nó real ganha estado vivo", ["ativo", "dormente"].includes(vivo.corpo?.vivo?.n_real?.estado), vivo.corpo?.vivo?.n_real?.estado);
    verificar("nó fantasma fica não encontrado", vivo.corpo?.vivo?.n_fantasma?.estado === ESTADO.NAO_ENCONTRADO);

    const ressinc = await pedir(PORTA, "/api/opencode/ressincronizar", { method: "POST", headers: jsonCom, corpo: {} });
    verificar("ressincronização recompõe contagem", ressinc.corpo?.nSessoes === 5);

    const voltar = await pedir(PORTA, "/api/opencode/modo", { method: "POST", headers: jsonCom, corpo: { modo: "simulado" } });
    verificar("volta ao simulado", voltar.corpo?.modo === "simulado");

    /* ── Estabilidade: releitura periódica e re-descoberta ─────────────── */
    console.log("\nEstabilidade (D32, D33)");
    const PORTA2 = PORTA + 7;
    const raiz2 = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-faseb2-"));
    const ponte2 = criarPonte({ porta: PORTA2, raiz: raiz2, opencodeUrl: urlFalsa, ressincMs: 200 });
    await ponte2.iniciar();
    const token2 = ponte2.identidade().token;
    const com2 = { authorization: `Bearer ${token2}` };
    const jsonCom2 = { ...com2, "content-type": "application/json", origin: `http://127.0.0.1:${PORTA2}` };
    try {
      await pedir(PORTA2, "/api/opencode/modo", { method: "POST", headers: jsonCom2, corpo: { modo: "real" } });
      const antes = (await pedir(PORTA2, "/api/opencode/estado", { headers: com2 })).corpo?.atualizadoEm;
      await new Promise((r) => setTimeout(r, 700));
      const depois = (await pedir(PORTA2, "/api/opencode/estado", { headers: com2 })).corpo;
      verificar("releitura periódica mantém inventário fresco", depois?.atualizadoEm > antes && depois?.nSessoes === 5, `antes=${antes} depois=${depois?.atualizadoEm}`);
    } finally {
      await ponte2.parar();
    }

    // Re-descoberta lê o arquivo a cada chamada, sem cache.
    const dirXdg = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-xdg-"));
    const xdgSalvo = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = dirXdg;
    try {
      fs.mkdirSync(path.join(dirXdg, "opencode"), { recursive: true });
      fs.writeFileSync(
        path.join(dirXdg, "opencode", "service.json"),
        JSON.stringify({ url: "http://127.0.0.1:1", password: SENHA_FALSA, version: "x" }),
      );
      const primeira = descobrirServico({});
      fs.writeFileSync(
        path.join(dirXdg, "opencode", "service.json"),
        JSON.stringify({ url: urlFalsa, password: SENHA_FALSA, version: "x" }),
      );
      const segunda = descobrirServico({});
      verificar(
        "descoberta reflete o arquivo atual (pós-reinício)",
        primeira.url === "http://127.0.0.1:1" && segunda.url === urlFalsa,
      );
    } finally {
      if (xdgSalvo === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = xdgSalvo;
    }

    const gravado = fs.readFileSync(path.join(localDir(raiz), "state.json"), "utf8");
    verificar("estado gravado não contém credencial", !gravado.includes(SENHA_FALSA));
  } finally {
    await ponte.parar();
    await new Promise((resolve) => falso.close(() => resolve()));
    if (casaAntiga === undefined) delete process.env.HOME;
    else process.env.HOME = casaAntiga;
    if (xdgAntigo === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = xdgAntigo;
  }

  console.log(`\nResultado: ${passou} ok, ${falhou} falha${falhou === 1 ? "" : "s"}.`);
  if (falhou) {
    console.log("\nFalhas:");
    for (const f of falhas) console.log(`  - ${f}`);
  }
  console.log("\nNenhum serviço real, projeto, chat ou worktree foi tocado.");
  process.exit(falhou ? 1 : 0);
}

main().catch((erro) => {
  console.error(`\nErro inesperado no teste: ${erro?.stack || erro}`);
  process.exitCode = 1;
});
