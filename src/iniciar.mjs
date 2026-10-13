/**
 * iniciar.mjs — comando único de entrada do TreeOffice (D48).
 *
 * Sobe a ponte, imprime o endereço com token e abre o navegador
 * automaticamente. Node puro, sem dependências, portátil Windows/Linux (D43).
 *
 * Uso:
 *   node src/iniciar.mjs [--porta 4717] [--raiz DIR] [--fonte simulado|real]
 *                        [--opencode-url URL] [--sem-abrir]
 *
 *   TREEOFFICE_NO_OPEN=1  desativa a abertura automática do navegador.
 *
 * Para encerrar: Ctrl+C. O estado permanece em `.local/`.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { criarPonte, PORTA_PADRAO } from "./server/bridge.mjs";
import { caminhos } from "./server/state-store.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_PROJETO = path.resolve(AQUI, "..");

function argumentos() {
  const args = process.argv.slice(2);
  const saida = {
    porta: PORTA_PADRAO,
    raiz: RAIZ_PROJETO,
    fonte: process.env.TREEOFFICE_FONTE === "real" ? "real" : "simulado",
    opencodeUrl: process.env.OPENCODE_SERVER_URL || null,
    abrir: process.env.TREEOFFICE_NO_OPEN !== "1",
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--porta") saida.porta = Number.parseInt(args[++i], 10);
    else if (args[i] === "--raiz") saida.raiz = path.resolve(args[++i]);
    else if (args[i] === "--fonte") saida.fonte = args[++i] === "real" ? "real" : "simulado";
    else if (args[i] === "--opencode-url") saida.opencodeUrl = args[++i];
    else if (args[i] === "--sem-abrir") saida.abrir = false;
  }
  if (!Number.isInteger(saida.porta) || saida.porta < 1 || saida.porta > 65535) {
    throw new Error(`Porta inválida: ${saida.porta}`);
  }
  return saida;
}

/** Abre o navegador de forma portátil; falha silenciosa nunca derruba a ponte. */
function abrirNavegador(url) {
  try {
    const plataforma = process.platform;
    const alvo = plataforma === "win32"
      ? { cmd: "cmd", args: ["/c", "start", "", url] }
      : plataforma === "darwin"
        ? { cmd: "open", args: [url] }
        : { cmd: "xdg-open", args: [url] };
    const filho = spawn(alvo.cmd, alvo.args, { detached: true, stdio: "ignore" });
    filho.unref();
  } catch {
    /* abrir o navegador é cortesia; o endereço impresso basta */
  }
}

const { porta, raiz, fonte, opencodeUrl, abrir } = argumentos();
const ponte = criarPonte({ porta, raiz, fonte, opencodeUrl });

ponte
  .iniciar()
  .then(() => {
    const caminho = caminhos(raiz);
    const endereco = `http://127.0.0.1:${ponte.porta}/?token=${ponte.identidade().token}`;
    console.log("");
    console.log(`TreeOffice — ponte (fonte inicial: ${fonte})`);
    console.log(`  Painel  ${endereco}`);
    console.log(`  Estado  ${caminho.estado}`);
    if (abrir) abrirNavegador(endereco);
    else console.log("  (abertura automática desativada; abra o endereço acima)");
    console.log("  Ctrl+C para encerrar.");
    console.log("");
    if (ponte.avisos().length) {
      console.log("  Avisos:");
      for (const a of ponte.avisos()) console.log(`   - ${a}`);
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
