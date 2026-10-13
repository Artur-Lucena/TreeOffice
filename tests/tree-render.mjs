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
let marcas = []; // coordenadas de cada fillText: medem a deriva dos rótulos
let rafCb = null;
let relogio = 0;

function canvasFalso() {
  const reg = { alfa: [], dash: [] };
  const ctx = {
    setTransform() {}, clearRect() {}, fillRect() {}, save() {}, restore() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {},
    setLineDash() {}, ellipse() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    arc(x, y, r) { arcs.push({ x, y, r }); },
    fillText(texto, x, y) {
      textos.push(String(texto));
      marcas.push({ texto: String(texto), x, y });
    },
  };
  Object.defineProperty(ctx, "globalAlpha", {
    set(v) { reg.alfa.push(v); },
    get() { return 1; },
  });
  Object.defineProperty(ctx, "lineDashOffset", {
    set(v) { reg.dash.push(v); },
    get() { return 0; },
  });
  return {
    getContext: () => ctx,
    addEventListener() {}, setPointerCapture() {}, hasPointerCapture() { return false; },
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ width: 900, height: 600, left: 0, top: 0 }),
    style: {},
    width: 0, height: 0,
    __ctx: ctx,
    __reg: reg,
  };
}

function cenario(estado, rotulo) {
  globalThis.window = { addEventListener() {}, devicePixelRatio: 1 };
  const tela = canvasFalso();
  globalThis.document = { getElementById: () => tela };
  globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
  relogio = 0;
  rafCb = null;
  arcs = [];
  textos = [];

  const arvore = criarArvore(tela, {});
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
  marcas = [];
  tela.__reg.alfa = [];
  tela.__reg.dash = [];
  passo(); // um quadro depois de tudo estabilizado

  const naoFinitos = arcs.filter(
    (a) => !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.r),
  );
  console.log(`\n== ${rotulo} ==`);
  console.log(`  arcs: ${arcs.length} | com NaN: ${naoFinitos.length}`);
  console.log(`  rótulos: ${JSON.stringify([...new Set(textos)])}`);
  return { arvore, naoFinitos, tela, passo };
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

/* ── Cenário 4: fluxo animado nas dependências (Onda 1) ───────────────────── */
console.log("\nCenário 4 — dependência tem fluxo animado no cheio e congela no desligado");
const comDep = JSON.parse(JSON.stringify(base));
comDep.dependencias.push({ origem: "n_grupo", destino: "n_orfao" });
const c4 = cenario(comDep, "uma dependência, efeitos cheios");
arcs = [];
c4.tela.__reg.dash = [];
c4.passo();
const offsetsCheio = [...c4.tela.__reg.dash];
c4.tela.__reg.dash = [];
c4.passo();
const offsetsCheio2 = [...c4.tela.__reg.dash];
verificar(
  "fluxo das dependências avança entre quadros",
  offsetsCheio.some((o) => o !== 0) && offsetsCheio.join() !== offsetsCheio2.join(),
  JSON.stringify(offsetsCheio.slice(0, 3)),
);
const semEfeito = JSON.parse(JSON.stringify(comDep));
semEfeito.preferencias = { efeitos: "desligado" };
const c4b = cenario(semEfeito, "uma dependência, efeitos desligados");
c4b.passo();
verificar(
  "efeitos desligados congelam o fluxo",
  c4b.tela.__reg.dash.every((o) => o === 0),
  JSON.stringify(c4b.tela.__reg.dash.slice(0, 3)),
);

/* ── Cenário 5: hover realça a vizinhança (Onda 1) ────────────────────────── */
console.log("\nCenário 5 — hover esmaece quem não é vizinho, sem remover ninguém");
const c5 = cenario(base, "hover sobre o nó do grupo");
c5.arvore.pairar("n_grupo");
c5.passo();
verificar(
  "hover esmaece não-vizinhos (alfa de esmaecimento registrado)",
  c5.tela.__reg.alfa.some((a) => a === 0.22),
  JSON.stringify(c5.tela.__reg.alfa.slice(0, 6)),
);
verificar("nó sob hover continua desenhado", textos.includes("Nó do grupo"));
c5.arvore.pairar(null);
c5.tela.__reg.alfa = [];
c5.passo();
verificar(
  "sem hover, nenhum esmaecimento",
  !c5.tela.__reg.alfa.some((a) => a === 0.22),
);

/* ── Cenário 6: deriva orgânica e poeira (Onda 1) ─────────────────────────── */
console.log("\nCenário 6 — nós derivam no cheio, ficam parados no desligado; poeira obedece");
const c6 = cenario(base, "deriva e poeira, efeitos cheios");
verificar("poeira existe no modo cheio", c6.arvore.efeitosInfo().poeira > 0, `${c6.arvore.efeitosInfo().poeira} partículas`);
// Deriva medida pelo X dos rótulos de título (o Y carrega o pulso do raio,
// que existe até no desligado; selos de ficha são excluídos porque orbitam
// o centro a raio pulsante; os corpos são curvas traçadas, não arcos).
const centros = () =>
  marcas
    .filter((m) => m.texto !== "–" && !/^\d+$/.test(m.texto))
    .map((m) => Math.round(m.x * 10000));
marcas = [];
c6.passo();
const fotoA = centros();
for (let i = 0; i < 8; i += 1) c6.passo();
marcas = [];
c6.passo();
const fotoB = centros();
verificar("nós à deriva mudam de centro entre quadros", fotoA.join() !== fotoB.join());
const parado = JSON.parse(JSON.stringify(base));
parado.preferencias = { efeitos: "desligado" };
const c6b = cenario(parado, "deriva e poeira, efeitos desligados");
verificar("poeira some no desligado", c6b.arvore.efeitosInfo().poeira === 0);
marcas = [];
c6b.passo();
const fotoC = centros();
for (let i = 0; i < 8; i += 1) c6b.passo();
marcas = [];
c6b.passo();
const fotoD = centros();
verificar("nós parados mantêm o centro entre quadros", fotoC.join() === fotoD.join());
verificar("nó do grupo segue visível no desligado", textos.includes("Nó do grupo"));

/* ── Cenário 7: naipes com significado (D49) ─────────────────────────────── */
console.log("\nCenário 7 — naipe codifica o papel; livre não tem naipe");
const comNaipes = {
  schemaVersion: 1,
  grupos: [{ id: "g_lider", titulo: "Comando", papel: "lideranca" }],
  nos: [
    { id: "n_chefe", titulo: "Chefe", grupoPai: "g_lider", papel: "lideranca", estado: "ativo", recolhido: false },
    { id: "n_obra", titulo: "Obra", grupoPai: "g_lider", papel: "execucao", estado: "dormente", recolhido: false },
    { id: "n_pista", titulo: "Pista", grupoPai: "g_lider", papel: "investigacao", estado: "ativo", recolhido: false },
    { id: "n_livro", titulo: "Livro", grupoPai: "g_lider", papel: "estudo", estado: "vazio", recolhido: false },
    { id: "n_solto", titulo: "Solto", grupoPai: "g_lider", estado: "ativo", recolhido: false },
  ],
  dependencias: [],
  preferencias: {},
};
const c7 = cenario(comNaipes, "um nó por papel mais um livre");
verificar("nenhum arco com coordenada NaN", c7.naoFinitos.length === 0, `${c7.naoFinitos.length} arcos`);
verificar("grupo liderança carrega ♠", textos.includes("Comando ♠"));
verificar("execução carrega ♥", textos.includes("Obra ♥"));
verificar("investigação carrega ♦", textos.includes("Pista ♦"));
verificar("estudo carrega ♣", textos.includes("Livro ♣"));
const solto = textos.find((t) => t === "Solto");
verificar("livre não tem naipe", solto !== undefined && !"♠♥♦♣".split("").some((s) => solto.includes(s)));

console.log(`\nResultado: ${passou} ok, ${falhou} falha${falhou === 1 ? "" : "s"}.`);
if (falhou) process.exitCode = 1;
console.log("\nNenhum projeto real, chat, worktree, vault ou OpenCode foi tocado.");
