/**
 * checar-sintaxe-ui.mjs — gate de sintaxe ESM para a interface.
 *
 * Contexto (D64): `node --check arquivo.js` NÃO acusa `await` fora de função
 * async nos arquivos da UI; a mesma checagem sobre cópia com extensão `.mjs`
 * acusa na hora. Este script copia cada `src/ui/*.js|*.mjs` para temporário
 * com extensão `.mjs` e roda `node --check`, falhando com mensagem clara.
 *
 * Uso: node scripts/checar-sintaxe-ui.mjs
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirUi = path.join(raiz, "src", "ui");
const arquivos = fs.readdirSync(dirUi).filter((n) => n.endsWith(".js") || n.endsWith(".mjs")).sort();
if (!arquivos.length) {
  console.error("nenhum arquivo de UI encontrado em src/ui");
  process.exit(1);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "treeoffice-sintaxe-"));
let falhas = 0;
for (const nome of arquivos) {
  const destino = path.join(tmp, nome.replace(/\.(js|mjs)$/, ".check.mjs"));
  fs.copyFileSync(path.join(dirUi, nome), destino);
  try {
    execFileSync(process.execPath, ["--check", destino], { stdio: "pipe" });
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    falhas += 1;
    const saida = (erro.stderr?.toString() || erro.message).split("\n").slice(0, 6).join("\n");
    console.log(`  FALHA ${nome}\n${saida}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `\nResultado: ${falhas} arquivo(s) com erro de sintaxe.` : `\nResultado: ${arquivos.length} arquivo(s) OK como ESM.`);
process.exit(falhas ? 1 : 0);
