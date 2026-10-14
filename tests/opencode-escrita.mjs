/**
 * opencode-escrita.mjs — Fase C: a ponte cria sessões reais sob ação explícita.
 *
 * Nada aqui toca no OpenCode real: a ponte roda em modo real contra um serviço
 * falso de loopback com `POST /api/session`. Diretórios de estado e HOME são
 * temporários; o repositório e o vault nunca são tocados.
 *
 * Uso:  node tests/opencode-escrita.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

import { criarPonte } from "../src/server/bridge.mjs";

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

const SENHA_FALSA = "fake-senha-escrita-456";
let criadas = 0;
let wtCriados = 0;

function authOk(req) {
  const esperado = `Basic ${Buffer.from(`opencode:${SENHA_FALSA}`, "utf8").toString("base64")}`;
  return req.headers.authorization === esperado;
}

function lerCorpoFalso(req) {
  return new Promise((resolve) => {
    let corpo = "";
    req.on("data", (p) => { corpo += p; });
    req.on("end", () => resolve(corpo));
  });
}

function criarFalso() {
  const servidor = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (!authOk(req)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ erro: "não autorizado" }));
      return;
    }
    if (url.pathname === "/api/info") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ version: "9.9.9-write" }));
      return;
    }
    if (url.pathname === "/api/project") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify([]));
      return;
    }
    if (url.pathname === "/api/session" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [], cursor: { previous: null, next: null } }));
      return;
    }
    if (url.pathname === "/api/session" && req.method === "POST") {
      const texto = await lerCorpoFalso(req);
      let pedido = null;
      try {
        pedido = JSON.parse(texto || "{}");
      } catch { /* inválido vira 400 */ }
      const titulo = typeof pedido?.title === "string" ? pedido.title.trim() : "";
      if (!titulo) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ erro: "title é obrigatório" }));
        return;
      }
      if (titulo === "forçar-erro") {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ erro: "pane simulada" }));
        return;
      }
      criadas += 1;
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: `ses_real_${criadas}`, title: titulo }));
      return;
    }
    if (url.pathname === "/api/worktree" && req.method === "POST") {
      const texto = await lerCorpoFalso(req);
      let pedido = null;
      try {
        pedido = JSON.parse(texto || "{}");
      } catch { /* inválido vira 400 */ }
      if (!pedido || typeof pedido.projectID !== "string" || !pedido.projectID) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ erro: "projectID é obrigatório" }));
        return;
      }
      if (pedido.name === "forçar-erro") {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ erro: "pane simulada" }));
        return;
      }
      wtCriados += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ directory: `/fake/wt/${wtCriados}` }));
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

const PORTA = Number.parseInt(process.env.TREEOFFICE_TEST_PORT3 || "47183", 10);

async function main() {
  console.log("\nTreeOffice — Fase C com serviço simulado\n");
  const falso = await criarFalso();
  const urlFalsa = `http://127.0.0.1:${falso.address().port}`;

  const casaFalsa = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-casa-w-"));
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-fasec-"));
  process.env.HOME = casaFalsa;
  fs.mkdirSync(path.join(casaFalsa, ".config", "opencode"), { recursive: true });
  fs.writeFileSync(path.join(casaFalsa, ".config", "opencode", "service.json"), JSON.stringify({ password: SENHA_FALSA }));

  const ponte = criarPonte({ porta: PORTA, raiz, opencodeUrl: urlFalsa });
  await ponte.iniciar();
  const token = ponte.identidade().token;
  const sem = {};
  const com = { authorization: `Bearer ${token}` };
  const jsonCom = { ...com, "content-type": "application/json", origin: `http://127.0.0.1:${PORTA}` };

  try {
    const corpo = { titulo: "Chat real 1", chave: "chave-1" };

    const semToken = await pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: { "content-type": "application/json", origin: `http://127.0.0.1:${PORTA}` }, corpo });
    verificar("sem token é recusado (401)", semToken.status === 401, `status=${semToken.status}`);

    const semOrigem = await pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: { ...com, "content-type": "application/json", origin: "http://site-estranho.com" }, corpo });
    verificar("escrita com origem estranha é recusada (403)", semOrigem.status === 403, `status=${semOrigem.status}`);

    const emSimulado = await pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: jsonCom, corpo });
    verificar("modo simulado não cria (409)", emSimulado.status === 409, `status=${emSimulado.status}`);
    verificar("nada foi criado no falso", criadas === 0, `criadas=${criadas}`);

    const modo = await pedir(PORTA, "/api/opencode/modo", { method: "POST", headers: jsonCom, corpo: { modo: "real" } });
    verificar("modo real ativa", modo.corpo?.modo === "real" && modo.corpo?.conectado === true, JSON.stringify(modo.corpo));

    const vazio = await pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: jsonCom, corpo: { titulo: "   ", chave: "chave-vazia" } });
    verificar("título vazio é recusado (400)", vazio.status === 400, `status=${vazio.status}`);

    const inexistente = await pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: jsonCom, corpo: { titulo: "X", chave: "chave-dir", directory: path.join(raiz, "nao-existe") } });
    verificar("diretório inexistente é recusado (400)", inexistente.status === 400, `status=${inexistente.status}`);

    const primeira = await pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: jsonCom, corpo });
    verificar("criação devolve sessionID (201)", primeira.status === 201 && primeira.corpo?.sessionID === "ses_real_1", `status=${primeira.status} corpo=${JSON.stringify(primeira.corpo)}`);
    verificar("resposta não vaza credencial", !primeira.texto.includes(SENHA_FALSA));

    const repetida = await pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: jsonCom, corpo });
    verificar("mesma chave não duplica (C4)", repetida.status === 201 && repetida.corpo?.sessionID === "ses_real_1" && criadas === 1, `criadas=${criadas}`);

    const segunda = await pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: jsonCom, corpo: { titulo: "Chat real 2", chave: "chave-2", directory: raiz } });
    verificar("chave nova cria outra sessão", segunda.status === 201 && segunda.corpo?.sessionID === "ses_real_2", JSON.stringify(segunda.corpo));

    const pane = await pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: jsonCom, corpo: { titulo: "forçar-erro", chave: "chave-erro" } });
    verificar("pane no serviço vira 502 sem vazar credencial", pane.status === 502 && !pane.texto.includes(SENHA_FALSA), `status=${pane.status}`);
    const antesConcorrente = criadas;
    const [c1, c2] = await Promise.all([
      pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: jsonCom, corpo: { titulo: "Concorrente", chave: "chave-race" } }),
      pedir(PORTA, "/api/opencode/sessoes", { method: "POST", headers: jsonCom, corpo: { titulo: "Concorrente", chave: "chave-race" } }),
    ]);
    verificar(
      "pedidos simultâneos com a mesma chave criam uma só (C4)",
      c1.status === 201 && c2.status === 201 && c1.corpo?.sessionID === c2.corpo?.sessionID && criadas === antesConcorrente + 1,
      `c1=${c1.corpo?.sessionID} c2=${c2.corpo?.sessionID} criadas=${criadas}`,
    );

    /* ── Fase D: criar worktree (RED: ponte ainda não cria) ─────────── */
    console.log("\nCriação de worktree (Fase D)");
    const wtBase = { projectID: "proj_a", branch: "main", name: "wt-1", chave: "wt-chave-1" };

    const wtSemToken = await pedir(PORTA, "/api/opencode/worktrees", { method: "POST", headers: { "content-type": "application/json", origin: `http://127.0.0.1:${PORTA}` }, corpo: wtBase });
    verificar("sem token é recusado (401)", wtSemToken.status === 401, `status=${wtSemToken.status}`);

    const wtOrigem = await pedir(PORTA, "/api/opencode/worktrees", { method: "POST", headers: { ...com, "content-type": "application/json", origin: "http://site-estranho.com" }, corpo: wtBase });
    verificar("origem estranha é recusada (403)", wtOrigem.status === 403, `status=${wtOrigem.status}`);

    const wtSemProjeto = await pedir(PORTA, "/api/opencode/worktrees", { method: "POST", headers: jsonCom, corpo: { ...wtBase, projectID: "" } });
    verificar("projectID vazio é recusado (400)", wtSemProjeto.status === 400, `status=${wtSemProjeto.status}`);

    const wtSemChave = await pedir(PORTA, "/api/opencode/worktrees", { method: "POST", headers: jsonCom, corpo: { ...wtBase, chave: "" } });
    verificar("chave vazia é recusada (400)", wtSemChave.status === 400, `status=${wtSemChave.status}`);

    const wtPrimeiro = await pedir(PORTA, "/api/opencode/worktrees", { method: "POST", headers: jsonCom, corpo: wtBase });
    verificar("criação devolve diretório (201)", wtPrimeiro.status === 201 && wtPrimeiro.corpo?.directory === "/fake/wt/1", `status=${wtPrimeiro.status} corpo=${JSON.stringify(wtPrimeiro.corpo)}`);
    verificar("resposta não vaza credencial", !wtPrimeiro.texto.includes(SENHA_FALSA));

    const wtReplay = await pedir(PORTA, "/api/opencode/worktrees", { method: "POST", headers: jsonCom, corpo: wtBase });
    verificar("mesma chave não duplica (D1)", wtReplay.status === 201 && wtReplay.corpo?.directory === "/fake/wt/1" && wtCriados === 1, `criados=${wtCriados}`);

    const antesRace = wtCriados;
    const [w1, w2] = await Promise.all([
      pedir(PORTA, "/api/opencode/worktrees", { method: "POST", headers: jsonCom, corpo: { ...wtBase, name: "wt-race", chave: "wt-chave-race" } }),
      pedir(PORTA, "/api/opencode/worktrees", { method: "POST", headers: jsonCom, corpo: { ...wtBase, name: "wt-race", chave: "wt-chave-race" } }),
    ]);
    verificar(
      "simultâneos com a mesma chave criam um só",
      w1.status === 201 && w2.status === 201 && w1.corpo?.directory === w2.corpo?.directory && wtCriados === antesRace + 1,
      `criados=${wtCriados}`,
    );

    const wtPane = await pedir(PORTA, "/api/opencode/worktrees", { method: "POST", headers: jsonCom, corpo: { ...wtBase, name: "forçar-erro", chave: "wt-chave-erro" } });
    verificar("pane no serviço vira 502 sem vazar credencial", wtPane.status === 502 && !wtPane.texto.includes(SENHA_FALSA), `status=${wtPane.status}`);

    const PORTA_SIM = PORTA + 9;
    const raizSim = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-fased-sim-"));
    const ponteSim = criarPonte({ porta: PORTA_SIM, raiz: raizSim, opencodeUrl: `http://127.0.0.1:${falso.address().port}` });
    await ponteSim.iniciar();
    try {
      const tokenSim = ponteSim.identidade().token;
      const jsonSim = { authorization: `Bearer ${tokenSim}`, "content-type": "application/json", origin: `http://127.0.0.1:${PORTA_SIM}` };
      const wtEmSimulado = await pedir(PORTA_SIM, "/api/opencode/worktrees", { method: "POST", headers: jsonSim, corpo: wtBase });
      verificar("modo simulado não cria worktree (409)", wtEmSimulado.status === 409, `status=${wtEmSimulado.status}`);
    } finally {
      await ponteSim.parar();
    }
  } finally {
    await ponte.parar();
    falso.close();
  }

  console.log(`\nResultado: ${passou} ok, ${falhou} falha${falhou === 1 ? "" : "s"}.`);
  if (falhas.length) {
    console.log("Falhas:");
    for (const f of falhas) console.log(`  - ${f}`);
  }
  console.log("\nNenhum serviço real, projeto, chat ou worktree foi tocado.");
  if (falhou) process.exitCode = 1;
}

main().catch((erro) => {
  console.error(`ERRO: ${erro?.message || erro}`);
  process.exitCode = 1;
});
