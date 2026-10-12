/**
 * tree-render.mjs — teste do renderizador sem navegador.
 *
 * O smoke test cobre a ponte; este cobre o tree.js, que roda no navegador e
 * portanto fica fora do alcance do smoke. Ele cria um DOM falso, instancia o
 * `criarArvore` real e observa o que seria desenhado: chamadas de `arc` e
 * rótulos de `fillText`. Nada aqui toca em projetos, chats, worktrees, vault
 * ou no OpenCode — é simulação pura (D25).
 *
 * O que este teste já pegou (regressões reais, em 12/10/2026):
 *   1. nós desenhados em NaN, porque entradas de posição nasciam sem
 *      vx/vy/fase e `inicializarPosicoes` nunca era chamado — a árvore
 *      inteira era invisível;
 *   2. nó criado sem origem (`grupoPai: null`) nunca recebia âncora e também
 *      não era desenhado — o botão "criar chat" não tinha retorno visual;
 *   3. subárvore de galho recolhido continuava desenhada, e o selo de
 *      contagem nunca aparecia por sombreamento de `estado` em `desenharNo`.
 *
 * Uso:  node tests/tree-render.mjs
 */

import { criarArvore } from "../src/ui/tree.js";

let arcs = [];
let textos = [];
let rafCb = null;
let relogio = 0;

function canvasFalso() {
  const ctx = {
    setTransform() {}, clearRect() {}, fillRect() {}, save() {}, restore() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {},
    setLineDash() {}, ellipse() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    arc(x, y, r) { arcs.push({ x, y, r }); },
    fillText(texto) { textos.push(String(texto)); },
  };
  return {
    getContext: () => ctx,
    addEventListener() {}, setPointerCapture() {}, hasPointerCapture() { return false; },
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ width: 900, height: 600, left: 0, top: 0 }),
    width: 0, height: 0,
  };
}

function cenario(estado, rotulo) {
  globalThis.window = { addEventListener() {}, devicePixelRatio: 1 };
  globalThis.document = { getElementById: () => canvasFalso() };
  globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
  relogio = 0;
  rafCb = null;
  arcs = [];
  textos = [];

  const arvore = criarArvore(canvasFalso(), {});
  arvore.definirEstado(estado, {});

  const passo = () => {
    const cb = rafCb;
    rafCb = null;
    relogio += 16;
    cb && cb(relogio);
  };
  for (let i = 0; i < 12; i += 1) passo();
  arcs = [];
  textos = [];
  passo(); // um quadro depois de tudo estabilizado

  const naoFinitos = arcs.filter(
    (a) => !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.r),
  );
  console.log(`\n== ${rotulo} ==`);
  console.log(`  arcs: ${arcs.length} | com NaN: ${naoFinitos.length}`);
  console.log(`  rótulos: ${JSON.stringify([...new Set(textos)])}`);
  return { arvore, naoFinitos };
}

let passou = 0;
let falhou = 0;
function verificar(nome, condicao, detalhe = "") {
  if (condicao) {
    passou += 1;
    console.log(`  ok   ${nome}`);
  } else {
    falhou += 1;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

const base = {
  schemaVersion: 1,
  grupos: [{ id: "g_execucao", titulo: "Execução", papel: "execucao" }],
  nos: [
    { id: "n_grupo", titulo: "Nó do grupo", grupoPai: "g_execucao", estado: "ativo", recolhido: false },
    { id: "n_orfao", titulo: "Nó sem grupo", grupoPai: null, estado: "vazio", recolhido: false },
    { id: "n_filho_orfao", titulo: "Filho do órfão", grupoPai: "n_orfao", estado: "ativo", recolhido: false },
  ],
  dependencias: [],
  preferencias: {},
};

/* ── Cenário 1: nó sem grupo e filho de nó sem grupo ─────────────────────── */
console.log("\nCenário 1 — órfãos recebem âncora e são desenhados");
const c1 = cenario(base, "grupo + órfão + filho de órfão");
verificar("nenhum arco com coordenada NaN", c1.naoFinitos.length === 0, `${c1.naoFinitos.length} arcos`);
verificar("nó do grupo é desenhado", textos.includes("Nó do grupo"));
verificar("nó sem grupo é desenhado", textos.includes("Nó sem grupo"));
verificar("filho do nó sem grupo é desenhado", textos.includes("Filho do órfão"));
const antes = c1.arvore.camera();
c1.arvore.focar("n_orfao");
const depois = c1.arvore.camera();
verificar(
  "focar um órfão move a câmera",
  antes.alvoX !== depois.alvoX || antes.alvoY !== depois.alvoY,
);

/* ── Cenário 2: galho recolhido ──────────────────────────────────────────── */
console.log("\nCenário 2 — galho recolhido esconde a subárvore, não o nó");
const colapsado = JSON.parse(JSON.stringify(base));
colapsado.nos.push({ id: "n_pai_fechado", titulo: "Pai recolhido", grupoPai: "g_execucao", estado: "ativo", recolhido: true });
colapsado.nos.push({ id: "n_filho_oculto", titulo: "Filho oculto", grupoPai: "n_pai_fechado", estado: "ativo", recolhido: false });
const c2 = cenario(colapsado, "pai recolhido com um filho");
verificar("nenhum arco com coordenada NaN", c2.naoFinitos.length === 0, `${c2.naoFinitos.length} arcos`);
verificar("nó recolhido continua visível", textos.includes("Pai recolhido"));
verificar('selo de contagem do recolhido aparece ("1")', textos.includes("1"));
verificar("filho do recolhido não é desenhado", !textos.includes("Filho oculto"));

/* ── Cenário 3: pai que deixou de existir ─────────────────────────────────── */
console.log("\nCenário 3 — nó com pai inexistente não some da tela (D21)");
const semPai = JSON.parse(JSON.stringify(base));
semPai.nos.push({ id: "n_pai_sumiu", titulo: "Pai removido", grupoPai: "n_fantasma", estado: "dormente", recolhido: false });
const c3 = cenario(semPai, "grupoPai aponta para id inexistente");
verificar("nenhum arco com coordenada NaN", c3.naoFinitos.length === 0, `${c3.naoFinitos.length} arcos`);
verificar("nó com pai inexistente é desenhado", textos.includes("Pai removido"));

console.log(`\nResultado: ${passou} ok, ${falhou} falha${falhou === 1 ? "" : "s"}.`);
if (falhou) process.exitCode = 1;
console.log("\nNenhum projeto real, chat, worktree, vault ou OpenCode foi tocado.");
