/**
 * opencode-importacao.mjs — Fase B (B5): a ponte lista sessões reais ainda
 * não vinculadas, para importação seletiva explícita.
 *
 * Nada toca no OpenCode real: ponte em modo real contra serviço falso de
 * loopback. Só leitura no serviço; os nós nascem depois, no navegador, por
 * ação explícita (coberta no browser-ui).
 *
 * Uso:  node tests/opencode-importacao.mjs
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
  if (condicao) { passou += 1; console.log(`  ok   ${nome}`); }
  else { falhou += 1; falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ""}`); console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`); }
}

const SENHA_FALSA = "fake-senha-importacao-789";
const SESSOES = [
  { id: "ses_i1", projectID: "proj_a", title: "Alfa importável", outcome: null, time: { created: 1, updated: 30 }, messages: [{ role: "user", content: "SEGREDO-NUNCA-VAZA" }] },
  { id: "ses_i2", projectID: "proj_a", title: "Bravo importável", outcome: null, time: { created: 1, updated: 20 } },
  { id: "ses_i3", projectID: "proj_b", title: "Charlie outro projeto", outcome: null, time: { created: 1, updated: 10 } },
];
let pane = false;

function authOk(req) {
  return req.headers.authorization === `Basic ${Buffer.from(`opencode:${SENHA_FALSA}`, "utf8").toString("base64")}`;
}
function criarFalso() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const out = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (!authOk(req)) return out(401, { erro: "não autorizado" });
    if (pane) return out(500, { erro: "pane simulada" });
    if (url.pathname === "/api/info") return out(200, { version: "9.9.9-import" });
    if (url.pathname === "/api/project") return out(200, [{ id: "proj_a", canonical: "/fake/a" }, { id: "proj_b", canonical: "/fake/b" }]);
    if (url.pathname === "/api/session" && req.method === "GET") {
      // Duas páginas para provar a travessia por cursor.
      const cursor = url.searchParams.get("cursor");
      const pagina = cursor === "pag2" ? SESSOES.slice(2) : SESSOES.slice(0, 2);
      return out(200, { data: pagina, cursor: { previous: null, next: cursor ? null : "pag2" } });
    }
    return out(404, { erro: "desconhecido" });
  });
}

async function main() {
  const casa = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-import-casa-"));
  const casaAntiga = process.env.HOME;
  process.env.HOME = casa;
  fs.mkdirSync(path.join(casa, ".config", "opencode"), { recursive: true });
  fs.writeFileSync(path.join(casa, ".config", "opencode", "service.json"), JSON.stringify({ password: SENHA_FALSA }));
  const falso = criarFalso();
  await new Promise((r) => falso.listen(0, "127.0.0.1", r));
  const urlFalsa = `http://127.0.0.1:${falso.address().port}`;

  const PORTA = 47201;
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-import-"));
  const ponte = criarPonte({ porta: PORTA, raiz, fonte: "simulado", opencodeUrl: urlFalsa });
  await ponte.iniciar();
  const base = `http://127.0.0.1:${PORTA}`;
  const token = ponte.identidade().token;
  const H = (extra = {}) => ({ authorization: `Bearer ${token}`, origin: base, ...extra });
  const pedir = (caminho, init = {}) => fetch(`${base}${caminho}`, { headers: H({ "content-type": "application/json" }), ...init })
    .then(async (r) => {
      const texto = await r.text();
      let corpo = {};
      try { corpo = JSON.parse(texto); } catch { /* corpo não-JSON vira {} */ }
      return { status: r.status, corpo, texto };
    });

  try {
    console.log("\nTreeOffice — importação seletiva (B5), contra serviço falso");
    // Estado com uma sessão já vinculada: não pode reaparecer.
    const est0 = await (await fetch(`${base}/api/estado`, { headers: H() })).json();
    est0.state.nos = [{ id: "n_vinc", titulo: "Já vinculada", papel: "livre", sessionID: "ses_i2" }];
    await fetch(`${base}/api/estado`, { method: "POST", headers: H(), body: JSON.stringify({ state: est0.state }) });

    const semToken = await fetch(`${base}/api/opencode/nao-vinculadas`, { headers: { origin: base } });
    verificar("sem token é recusado (401)", semToken.status === 401, `status=${semToken.status}`);

    const origemRuim = await fetch(`${base}/api/opencode/nao-vinculadas`, { headers: { ...H(), origin: "http://site-estranho.com" } });
    verificar("origem estranha é recusada (403)", origemRuim.status === 403, `status=${origemRuim.status}`);

    const emSimulado = await pedir("/api/opencode/nao-vinculadas");
    verificar("modo simulado não lista (409)", emSimulado.status === 409, `status=${emSimulado.status}`);

    await pedir("/api/opencode/modo", { method: "POST", body: JSON.stringify({ modo: "real" }) });
    const todas = await pedir("/api/opencode/nao-vinculadas");
    const ids = (todas.corpo?.data || []).map((s) => s.id);
    verificar("lista as não vinculadas (200, travessia de cursor)", todas.status === 200 && ids.includes("ses_i1") && ids.includes("ses_i3") && ids.length === 2, `status=${todas.status} ids=${ids}`);
    verificar("vinculada não reaparece", !ids.includes("ses_i2"));
    const lista = todas.corpo?.data || [];
    verificar("ordenadas por recência", lista[0]?.id === "ses_i1");
    verificar("só identificadores, sem conteúdo de conversa", !JSON.stringify(todas.corpo).includes("SEGREDO-NUNCA-VAZA") && lista[0]?.messages === undefined);

    const soA = await pedir("/api/opencode/nao-vinculadas?projectID=proj_a");
    verificar("filtro por projeto", soA.corpo?.data?.map((s) => s.id).join() === "ses_i1", JSON.stringify(soA.corpo?.data));
    const busca = await pedir("/api/opencode/nao-vinculadas?busca=charlie");
    verificar("busca por título", busca.corpo?.data?.map((s) => s.id).join() === "ses_i3");
    const teto = await pedir("/api/opencode/nao-vinculadas?limit=1");
    verificar("teto de resposta respeitado", teto.corpo?.data?.length === 1);

    pane = true;
    const paneResp = await pedir("/api/opencode/nao-vinculadas");
    verificar("pane no serviço vira 502 sem vazar credencial", paneResp.status === 502 && !JSON.stringify(paneResp.corpo).includes(SENHA_FALSA), `status=${paneResp.status}`);
    pane = false;
  } finally {
    await ponte.parar();
    falso.close();
    if (casaAntiga === undefined) delete process.env.HOME;
    else process.env.HOME = casaAntiga;
  }
  console.log(`\nResultado: ${passou} ok, ${falhou} falha${falhou === 1 ? "" : "s"}.`);
  if (falhou) { console.log("\nFalhas:"); for (const f of falhas) console.log(`  - ${f}`); }
  console.log("\nNenhum serviço real, projeto, chat ou worktree foi tocado.");
  process.exit(falhou ? 1 : 0);
}
main().catch((erro) => { console.error(`\nErro inesperado no teste: ${erro?.stack || erro}`); process.exitCode = 1; });
