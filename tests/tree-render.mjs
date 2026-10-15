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

import { criarArvore, aplicarRepulsao } from "../src/ui/tree.js";

let arcs = [];
let textos = [];
let marcas = []; // coordenadas de cada fillText: medem a deriva dos rótulos
let tracados = [];
let rafCb = null;
let relogio = 0;

function canvasFalso() {
  const reg = { alfa: [], dash: [], largura: [], traco: [], espaco: [] };
  const eventos = new Map();
  let pontos = [];
  const ctx = {
    setTransform() {}, clearRect() {}, fillRect() {}, save() {}, restore() {},
    beginPath() { pontos = []; },
    moveTo(x, y) { pontos.push({ x, y }); },
    lineTo(x, y) { pontos.push({ x, y }); },
    closePath() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {},
    setLineDash() {}, ellipse() {}, clip() {}, translate() {}, rotate() {},
    measureText(texto) { return { width: String(texto).length * 7 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    arc(x, y, r) { arcs.push({ x, y, r }); },
    fillText(texto, x, y) {
      textos.push(String(texto));
      marcas.push({ texto: String(texto), x, y, font: ctx.font });
    },
  };
  ctx.stroke = () => tracados.push({ pontos: [...pontos], estilo: ctx.strokeStyle });
  Object.defineProperty(ctx, "globalAlpha", {
    set(v) { reg.alfa.push(v); },
    get() { return 1; },
  });
  Object.defineProperty(ctx, "lineDashOffset", {
    set(v) { reg.dash.push(v); },
    get() { return 0; },
  });
  Object.defineProperty(ctx, "lineWidth", {
    set(v) { reg.largura.push(v); },
    get() { return 1; },
  });
  Object.defineProperty(ctx, "strokeStyle", {
    set(v) { reg.traco.push(v); },
    get() { return ""; },
  });
  Object.defineProperty(ctx, "letterSpacing", {
    set(v) { reg.espaco.push(v); },
    get() { return "0px"; },
  });
  return {
    getContext: () => ctx,
    addEventListener(tipo, cb) { eventos.set(tipo, cb); },
    disparar(tipo, dados = {}) {
      eventos.get(tipo)?.({ pointerId: 1, button: 0, clientX: 0, clientY: 0, preventDefault() {}, ...dados });
    },
    setPointerCapture() {}, hasPointerCapture() { return false; },
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ width: 900, height: 600, left: 0, top: 0 }),
    style: {},
    width: 0, height: 0,
    __ctx: ctx,
    __reg: reg,
  };
}

function cenario(estado, rotulo, reduzir = false) {
  globalThis.window = { addEventListener() {}, devicePixelRatio: 1, matchMedia: () => ({ matches: reduzir }) };
  const tela = canvasFalso();
  globalThis.document = { getElementById: () => tela };
  globalThis.requestAnimationFrame = (cb) => { rafCb = cb; };
  relogio = 0;
  globalThis.performance = { now: () => relogio };
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
  tracados = [];
  tela.__reg.alfa = [];
  tela.__reg.dash = [];
  tela.__reg.largura = [];
  tela.__reg.traco = [];
  tela.__reg.espaco = [];
  passo(); // um quadro depois de tudo estabilizado

  const naoFinitos = [
    ...arcs.filter((a) => !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.r)),
    ...tracados.flatMap((t) => t.pontos).filter((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)),
  ];
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
  "dependência uniforme é identificável e selecionável",
  c4.arvore.conexoes().some(c=>c.tipo==="Dependência"),
  JSON.stringify(offsetsCheio.slice(0, 3)),
);
arcs = [];
c4.passo();
verificar(
  "fios não exibem partículas nem pontos móveis",
  arcs.filter((a) => a.r === 2 * 0.75).length === 0,
  `${arcs.filter((a) => a.r === 2 * 0.75).length} partículas`,
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
arcs = [];
c4b.passo();
verificar(
  "desligado não tem partículas (só poeira zerada e fichas)",
  arcs.filter((a) => a.r === 2 * 0.75).length === 0,
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
verificar("execução carrega ♥", textos.includes("Obra") && textos.includes("♥"));
verificar("investigação carrega ♦", textos.includes("Pista") && textos.includes("♦"));
verificar("estudo carrega ♣", textos.includes("Livro") && textos.includes("♣"));
const solto = textos.find((t) => t === "Solto");
verificar("livre não tem naipe", solto !== undefined && !"♠♥♦♣".split("").some((s) => solto.includes(s)));

/* ── Cenário 8: colisão entre corpos (D50) ───────────────────────────────── */
console.log("\nCenário 8 — repulsão desgruda corpos; âncoras continuam mandando");

// Núcleo puro: par coincidente separa sem NaN nem explosão.
const par = [
  { x: 0, y: 0, vx: 0, vy: 0 },
  { x: 0, y: 0, vx: 0, vy: 0 },
];
for (let i = 0; i < 60; i += 1) {
  aplicarRepulsao(par, 20);
  for (const c of par) {
    c.vx *= 0.86;
    c.vy *= 0.86;
    c.x += c.vx;
    c.y += c.vy;
  }
}
const distPar = Math.hypot(par[0].x - par[1].x, par[0].y - par[1].y);
verificar("par coincidente termina separado", distPar >= 2 * 20 + 12, `dist=${distPar.toFixed(1)}`);
verificar(
  "separação sem NaN nem fuga",
  par.every((c) => [c.x, c.y, c.vx, c.vy].every(Number.isFinite)) && distPar < 10000,
);

// Par próximo separa; par distante não é tocado.
const perto = [
  { x: 0, y: 0, vx: 0, vy: 0 },
  { x: 10, y: 0, vx: 0, vy: 0 },
];
for (let i = 0; i < 60; i += 1) {
  aplicarRepulsao(perto, 20);
  for (const c of perto) {
    c.vx *= 0.86;
    c.vy *= 0.86;
    c.x += c.vx;
    c.y += c.vy;
  }
}
verificar(
  "par próximo respeita a distância mínima",
  Math.hypot(perto[0].x - perto[1].x, perto[0].y - perto[1].y) >= 2 * 20 + 12,
);
const longe = [
  { x: 0, y: 0, vx: 0, vy: 0 },
  { x: 200, y: 0, vx: 0, vy: 0 },
];
aplicarRepulsao(longe, 20);
verificar("par distante não recebe impulso", longe[0].vx === 0 && longe[1].vx === 0);

// Determinismo: mesma entrada, mesma saída (sem aleatoriedade).
const copia = () => [
  { x: 0, y: 0, vx: 0, vy: 0 },
  { x: 5, y: -3, vx: 0, vy: 0 },
];
const rodada = () => {
  const c = copia();
  for (let i = 0; i < 30; i += 1) {
    aplicarRepulsao(c, 20);
    for (const k of c) {
      k.vx *= 0.86;
      k.vy *= 0.86;
      k.x += k.vx;
      k.y += k.vy;
    }
  }
  return c;
};
verificar("repulsão é determinística", JSON.stringify(rodada()) === JSON.stringify(rodada()));

// Integração: irmãos de grupo nascem em âncoras distintas e corpos nunca se
// interpenetram além de um diâmetro (a distância mínima cheia é limitada
// pela âncora por desenho — repulsão corrige o local, âncora manda no global).
const denso = {
  schemaVersion: 1,
  grupos: [{ id: "g_denso", titulo: "Denso", papel: "execucao" }],
  nos: [],
  dependencias: [],
  preferencias: {},
};
for (let i = 0; i < 8; i += 1) {
  denso.nos.push({
    id: `n_f${i}`,
    titulo: `Filho ${i}`,
    grupoPai: "g_denso",
    papel: "execucao",
    estado: "ativo",
    recolhido: false,
  });
}
const c8 = cenario(denso, "grupo denso de um nível");
const posInicial = c8.arvore._debugPosicoes().filter((p) => p.camada === "no");
const paresIguais = posInicial.filter((p, i, arr) => arr.findIndex((q) => q.x === p.x && q.y === p.y) !== i);
verificar("irmãos não nascem empilhados", paresIguais.length === 0, `${paresIguais.length} sobrepostos`);
for (let i = 0; i < 30; i += 1) c8.passo();
const pos = c8.arvore._debugPosicoes().filter((p) => p.camada === "no" && Number.isFinite(p.x) && Number.isFinite(p.y));
let menor = Infinity;
for (let i = 0; i < pos.length; i += 1) {
  for (let j = i + 1; j < pos.length; j += 1) {
    menor = Math.min(menor, Math.hypot(pos[i].x - pos[j].x, pos[i].y - pos[j].y));
  }
}
// O zoom é só câmera: o diâmetro físico não encolhe em unidades de mundo.
verificar("corpos não se interpenetram após 30 quadros", menor >= 2 * 26, `menor=${menor.toFixed(1)}`);

/* ── Cenário 9: arrasto cutuca a física e soltar devolve à âncora (D51) ─── */
console.log("\nCenário 9 — agarrar, empurrar vizinho, soltar e voltar");
const c9 = cenario(base, "arrasto em órfão e nó do grupo");
const pos0 = c9.arvore._debugPosicoes();
const a0 = pos0.find((p) => p.id === "n_orfao");
const b0 = pos0.find((p) => p.id === "n_grupo");
verificar("moverNo desloca imediatamente", c9.arvore.moverNo("n_orfao", b0.x - a0.x, b0.y - a0.y) === true);
verificar("moverNo recusa delta inválido", c9.arvore.moverNo("n_orfao", NaN, 0) === false);
verificar("moverNo recusa nó inexistente", c9.arvore.moverNo("n_fantasma", 1, 1) === false);

// Segurar de verdade pelo handler, não alterando internamente o estado de drag.
const telaDe = (c, p) => {
  const cam = c.arvore.camera();
  return { clientX: 450 + (p.x - cam.x) * cam.zoom, clientY: 300 + (p.y - cam.y) * cam.zoom };
};
c9.tela.disparar("pointerdown", telaDe(c9, b0));
c9.passo();
const paSegurado = c9.arvore._debugPosicoes().find((p) => p.id === "n_orfao");
verificar("nó agarrado fica no cursor", Math.hypot(paSegurado.x - b0.x, paSegurado.y - b0.y) < 1);

let maxDesloc = 0;
for (let i = 0; i < 20; i += 1) {
  c9.passo();
  const pb = c9.arvore._debugPosicoes().find((p) => p.id === "n_grupo");
  maxDesloc = Math.max(maxDesloc, Math.hypot(pb.x - b0.x, pb.y - b0.y));
}
verificar("vizinho reage ao vivo ao arrasto", maxDesloc > 1.5, `desloc=${maxDesloc.toFixed(1)}`);

c9.tela.disparar("pointerup", telaDe(c9, b0));
for (let i = 0; i < 80; i += 1) c9.passo();
const paSolto = c9.arvore._debugPosicoes().find((p) => p.id === "n_orfao");
verificar(
  "soltar preserva a organização manual sem retorno à origem",
  Math.hypot(paSolto.x - a0.x, paSolto.y - a0.y) > 80,
  `dist=${Math.hypot(paSolto.x - a0.x, paSolto.y - a0.y).toFixed(1)}`,
);

console.log("\nCenário 10 — gesto lento e cancelamento não prendem o nó");
const c10 = cenario(base, "gestos pelo handler");
const no10 = c10.arvore._debugPosicoes().find((p) => p.id === "n_grupo");
const t10 = telaDe(c10, no10);
const cam10 = c10.arvore.camera();
c10.tela.disparar("pointerdown", t10);
for (let i = 1; i <= 12; i++) c10.tela.disparar("pointermove", { ...t10, clientX: t10.clientX + i * 2 });
c10.passo();
verificar("arrasto lento desloca o nó, não a câmera", c10.arvore._debugPosicoes().find((p) => p.id === no10.id).x > no10.x + 1 && c10.arvore.camera().alvoX === cam10.alvoX);
const antesCancelamento=c10.arvore._debugPosicoes().find(p=>p.id===no10.id);
c10.tela.disparar("pointercancel", t10);
for (let i = 0; i < 100; i++) c10.passo();
const cancelado = c10.arvore._debugPosicoes().find((p) => p.id === no10.id);
verificar("cancelamento libera o gesto e conserva o ponto alcançado", Math.hypot(cancelado.x - antesCancelamento.x, cancelado.y - antesCancelamento.y) < 2);

console.log("\nCenário 11 — separação vale também em dois níveis e zoom baixo");
const doisNiveis = structuredClone(denso);
for (let i = 0; i < 8; i++) for (let k = 0; k < 2; k++) {
  doisNiveis.nos.push({ id: `n_neto_${i}_${k}`, titulo: `Neto ${i}.${k}`, grupoPai: `n_f${i}`, estado: "ativo" });
}
const c11 = cenario(doisNiveis, "ramos próximos");
c11.arvore.aplicarZoom(0.4);
for (let i = 0; i < 180; i++) c11.passo();
const ps11 = c11.arvore._debugPosicoes().filter((p) => p.camada === "no");
let dist11 = Infinity;
for (let i = 0; i < ps11.length; i++) for (let j = i + 1; j < ps11.length; j++) dist11 = Math.min(dist11, Math.hypot(ps11[i].x - ps11[j].x, ps11[i].y - ps11[j].y));
verificar("colisão não depende do zoom nem perde para a mola", dist11 >= 2 * 26 * 1.3 + 12, `dist=${dist11.toFixed(1)}`);

console.log("\nCenário 12 — naipe legível no zoom baixo e energia com relógio real");
const unico = { grupos: [], nos: [{ id: "n_papel", titulo: "Investigar", papel: "investigacao", estado: "ativo" }], dependencias: [], preferencias: { efeitos: "desligado" } };
const c12 = cenario(unico, "zoom reduzido");
c12.arvore.aplicarZoom(0.4);
for (let i = 0; i < 60; i++) c12.passo();
verificar("naipe não desaparece no zoom baixo", marcas.some((m) => m.texto.includes("♦") && Number.parseFloat(m.font) >= 14));

const diametroDesenho = () => {
  const blob = tracados.filter((t) => t.pontos.length >= 28).at(-1);
  return blob ? Math.max(...blob.pontos.map((p) => p.x)) - Math.min(...blob.pontos.map((p) => p.x)) : 0;
};
const recente = cenario(unico, "recência em milissegundos de época");
recente.arvore.definirVivo({ n_papel: { estado: "dormente", desde: Date.now() } });
for (let i = 0; i < 90; i++) recente.passo();
tracados = []; recente.passo();
const diamRecente = diametroDesenho();
recente.arvore.definirVivo({ n_papel: { estado: "dormente", desde: Date.now() - 600000 } });
for (let i = 0; i < 90; i++) recente.passo();
tracados = []; recente.passo();
verificar("atividade antiga murcha; Date.now não é confundido com RAF", diametroDesenho() < diamRecente * 0.9);

const quieto = cenario(unico, "movimento reduzido", true);
tracados = []; quieto.passo();
const fotoQuieto = JSON.stringify(tracados);
tracados = []; quieto.passo();
verificar("movimento reduzido mantém blob e naipe visíveis e sem pulso", fotoQuieto === JSON.stringify(tracados) && textos.some((t) => t.includes("♦")));

console.log("\nCenário 13 — centralizar enquadra os nós em vez de voltar à origem fixa");
const c13 = cenario(comNaipes, "enquadramento");
c13.arvore.centrar();
const cam13 = c13.arvore.camera();
const pos13 = c13.arvore._debugPosicoes().filter((p) => p.camada === "no");
const meio13 = (Math.min(...pos13.map((p) => p.x)) + Math.max(...pos13.map((p) => p.x))) / 2;
verificar("enquadramento usa o centro real do grafo", Math.abs(cam13.alvoX - meio13) < 1);
verificar("enquadramento reserva espaço para o corpo e rótulos", pos13.every((p) => Math.abs((p.x - cam13.alvoX) * cam13.alvoZoom) < 350 && Math.abs((p.y - cam13.alvoY) * cam13.alvoZoom) < 220));

/* ── Cenário 14: soltar plana em vez de estalar (D53) ───────────────────── */
console.log("\nCenário 14 — retorno suave após arrasto real pelo handler");
const c14 = cenario(base, "planagem");
const p14 = (id) => c14.arvore._debugPosicoes().find((q) => q.id === id);
const tela14 = (p) => {
  const cam = c14.arvore.camera();
  return { clientX: 450 + (p.x - cam.x) * cam.zoom, clientY: 300 + (p.y - cam.y) * cam.zoom };
};
const alvo14 = p14("n_orfao");
c14.tela.disparar("pointerdown", tela14(alvo14));
for (let i = 1; i <= 10; i += 1) {
  c14.tela.disparar("pointermove", {
    clientX: 450 + (alvo14.x - c14.arvore.camera().x) * 0.75 + i * 20,
    clientY: 300 + (alvo14.y - c14.arvore.camera().y) * 0.75,
  });
}
c14.tela.disparar("pointerup", { clientX: 650, clientY: 300 });
let pico = 0;
let anterior = p14("n_orfao");
for (let i = 0; i < 40; i += 1) {
  c14.passo();
  const atual = p14("n_orfao");
  pico = Math.max(pico, Math.hypot(atual.x - anterior.x, atual.y - anterior.y));
  anterior = atual;
}
verificar("deslizamento interpola o salto do cursor em vez de teleportar", pico > 0 && pico < 100, `pico=${pico.toFixed(2)}`);
for (let i = 0; i < 120; i += 1) c14.passo();
const deVolta = p14("n_orfao");
verificar(
  "deslizamento conclui no destino sem voltar à origem",
  Math.abs(deVolta.x-alvo14.x-200/0.75)<1,
  `dist=${Math.hypot(deVolta.x - alvo14.x, deVolta.y - alvo14.y).toFixed(1)}`,
);

/* ── Cenário 15: tubo de giz e tipografia (D53) ─────────────────────────── */
console.log("\nCenário 15 — galho em duas passadas e títulos com estilo");
const c15 = cenario(base, "tubo e tipo");
c15.tela.__reg.largura = [];
c15.tela.__reg.espaco = [];
c15.passo();
const larguras = [...new Set(c15.tela.__reg.largura.filter(Number.isFinite))];
verificar(
  "galhos usam núcleo uniforme sem contorno escuro de cruzamento",
  c15.tela.__reg.traco.some(t=>t.includes("0.58")),
  larguras.map((w) => w.toFixed(2)).join(", "),
);
verificar("títulos de grupo usam Amarante", marcas.some(m=>m.texto.includes("Execução") && m.font.includes("Amarante")));
verificar("títulos de nó zeram o espaçamento", c15.tela.__reg.espaco.includes("0px"));

/* ── Cenário 16: remover vínculo não mata o laço (regressão 15/10/2026) ────
 * O app filtra `state.nos` no MESMO objeto que a árvore guarda e só chama
 * `definirEstado` depois do POST (salvarAgora). O quadro no meio do caminho
 * lançava em `energiaDoNo(undefined)` e o laço morria antes de reagendar. */
console.log("\nCenário 16 — remoção de nó mantém o laço vivo");
const estado16 = JSON.parse(JSON.stringify(base));
const c16 = cenario(estado16, "remoção");
estado16.nos = estado16.nos.filter((n) => n.id !== "n_grupo");
let quebrou16 = false;
try {
  c16.passo();
} catch {
  quebrou16 = true;
}
verificar("quadro na janela transitória não lança", !quebrou16);
verificar("laço reagendado após a remoção", rafCb != null);
c16.arvore.definirEstado(estado16, {});
for (let i = 0; i < 8; i += 1) c16.passo();
textos = [];
c16.passo();
verificar("nó restante continua desenhado", textos.includes("Nó sem grupo"));
verificar("nó removido some do desenho", !textos.includes("Nó do grupo"));

console.log(`\nResultado: ${passou} ok, ${falhou} falha${falhou === 1 ? "" : "s"}.`);
if (falhou) process.exitCode = 1;
console.log("\nNenhum projeto real, chat, worktree, vault ou OpenCode foi tocado.");
