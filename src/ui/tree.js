/**
 * tree.js — renderização orgânica da árvore do TreeOffice.
 *
 * Canvas 2D puro, sem dependência externa (D45). Todo o desenho usa a API
 * 2D servida localmente pela ponte (D25).
 *
 * Regras visuais aplicadas:
 *   D15  três camadas: grupos, nós e dependências, com grafia distinta
 *   D16  chat parado continua visível em estado dormente; ausência de dado
 *        nunca é desenhada como estado
 *   posições são memorizadas: atualizações não provocam saltos
 *
 * Onda 1 de efeitos: deriva por ruído coerente (soma de senos com
 * frequências quase-irracionais), hover que realça a vizinhança, fluxo
 * animado nas dependências, poeira ambiente e vinheta — com densidade
 * configurável em `preferencias.efeitos` (cheio/sutil/desligado).
 */

const ESTADO = {
  ATIVO: "ativo",
  DORMENTE: "dormente",
  VAZIO: "vazio",
  NAO_ENCONTRADO: "nao_encontrado",
  INCERTO: "incerto",
};

/**
 * Naipes com significado (D49): o naipe codifica o papel organizacional no
 * lugar da cor, que morreu na transição para o giz monocromático.
 * Livre não tem naipe. Renderizados via fillText com fonte do sistema —
 * nenhum asset externo (D25).
 */
const NAIPE = {
  lideranca: "♠",
  execucao: "♥",
  investigacao: "♦",
  estudo: "♣",
};

export function naipeDe(papel) {
  return NAIPE[papel] || "";
}

/* Giz sobre quadro-negro: tudo em tons de giz quente; o único acento é o
 * brilho do estado ativo. Estados vivem em textura + contorno, não em cor. */
const GIZ = "232, 230, 222";
const SERIFA = `"Amarante", "Segoe UI", serif`;
const SANS = `"Manrope", "Segoe UI", system-ui, sans-serif`;

function hashNum(id) {
  let h = 0;
  const texto = String(id);
  for (let i = 0; i < texto.length; i += 1) h = (h * 31 + texto.charCodeAt(i)) & 0xffff;
  return (h % 1000) / 1000;
}

/**
 * Núcleo da colisão (D50): repulsão par a par entre corpos, espelho da carga
 * do Obsidian adaptado — aqui as âncoras continuam autoritárias e a repulsão
 * é só correção de curto alcance, para atualizações nunca provocarem saltos.
 *
 * `corpos`: itens mutáveis {x, y, vx, vy, raio?, fixo?}; `raio` é o fallback
 * em unidades de mundo (nunca pixels da câmera). Soma impulso em vx/vy;
 * integração e amortecimento
 * continuam no passo de física. Pares coincidentes ganham direção estável
 * por índice (sem aleatoriedade, sem NaN). Função pura de física, exportada
 * para teste direto.
 */
export function aplicarRepulsao(corpos, raio, opcoes = {}) {
  const respiro = opcoes.respiro ?? 12;
  const forca = opcoes.forca ?? 0.15;
  const teto = opcoes.teto ?? 6;
  for (let i = 0; i < corpos.length; i += 1) {
    for (let j = i + 1; j < corpos.length; j += 1) {
      const a = corpos[i];
      const b = corpos[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      let ux;
      let uy;
      let dist = d;
      if (d > 1e-9) {
        ux = dx / d;
        uy = dy / d;
      } else {
        const h = hashNum(`${i}:${j}`) * Math.PI * 2;
        ux = Math.cos(h);
        uy = Math.sin(h);
        dist = 0;
      }
      const minimo = (a.raio ?? raio) + (b.raio ?? raio) + respiro;
      if (dist < minimo) {
        const f = Math.min((minimo - dist) * forca, teto);
        if (!a.fixo) { a.vx -= ux * f; a.vy -= uy * f; }
        if (!b.fixo) { b.vx += ux * f; b.vy += uy * f; }
      }
    }
  }
}

// A mola define o layout, não autoriza interpenetração. Resolver o contato
// depois da integração impede que uma âncora forte anule a colisão.
function resolverContatos(corpos) {
  for (let iteracao = 0; iteracao < 12; iteracao++) {
    let mudou = false;
    for (let i = 0; i < corpos.length; i++) for (let j = i + 1; j < corpos.length; j++) {
      const a = corpos[i]; const b = corpos[j];
      if (a.fixo && b.fixo) continue;
      const dx = b.x - a.x; const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const falta = a.raio + b.raio + 12 - dist;
      if (falta <= 0.001) continue;
      const angulo = hashNum(`${i}:${j}`) * Math.PI * 2;
      const ux = dist > 1e-9 ? dx / dist : Math.cos(angulo);
      const uy = dist > 1e-9 ? dy / dist : Math.sin(angulo);
      const parteA = a.fixo ? 0 : b.fixo ? 1 : 0.5;
      const parteB = b.fixo ? 0 : a.fixo ? 1 : 0.5;
      a.x -= ux * falta * parteA; a.y -= uy * falta * parteA;
      b.x += ux * falta * parteB; b.y += uy * falta * parteB;
      mudou = true;
    }
    if (!mudou) break;
  }
}

/** Forma orgânica: círculo com modulação harmônica, sem dependências. */
function raioOrganico(tempo, fase, base) {
  const pulso =
    Math.sin(tempo * 0.0016 + fase) * 0.045 +
    Math.sin(tempo * 0.0031 + fase * 1.7) * 0.025 +
    Math.sin(tempo * 0.0053 + fase * 2.3) * 0.015;
  return base * (1 + pulso);
}

function lerp(atual, alvo, fator) {
  return atual + (alvo - atual) * fator;
}

/* ── Onda 1: deriva orgânica por soma quase-periódica ───────────────────────
 * Frequências quase-irracionais entre si nunca se realinham em ciclo curto:
 * o movimento parece vivo sem repetir padrão visível. É só renderização —
 * as âncoras da física não mudam, então não há saltos nem NaN propagado.
 */

function deriva(fase, tempo, amp) {
  return (
    Math.sin(tempo * 0.00023 + fase) +
    Math.sin(tempo * 0.00041 + fase * 1.3) * 0.6 +
    Math.sin(tempo * 0.00071 + fase * 0.7) * 0.3
  ) * amp * 0.53;
}

/** Amplitude da deriva por estado: ativo respira, dormente quase para. */
function ampDeriva(estadoNo) {
  if (estadoNo === ESTADO.ATIVO) return 7;
  if (estadoNo === ESTADO.INCERTO) return 3;
  if (estadoNo === ESTADO.DORMENTE) return 2.5;
  return 1.5;
}

export function criarArvore(canvas, opcoes = {}) {
  const ctx = canvas.getContext("2d");
  const onSelecionar = opcoes.onSelecionar || (() => {});
  const onOrganizar = opcoes.onOrganizar || (()=>{});
  let organizacaoPendente=false;
  const onSelecionarConexao = opcoes.onSelecionarConexao || (()=>{});
  let conexaoSelecionada=null, conexaoPairada=null;
  const onAcao = opcoes.onAcao || (() => {});
  const onErro = opcoes.onErro || ((erro) => console.error("TreeOffice: falha no desenho", erro));

  let estado = { grupos: [], nos: [], dependencias: [], preferencias: {} };
  let vivo = {};
  let selecionado = null;

  const camera = { x: 0, y: 0, zoom: 0.75, alvoX: 0, alvoY: 0, alvoZoom: 0.75 };
  const posicoes = new Map(); // id → {x, y, vx, vy, fase, alvoX, alvoY, camada}
  const arrastando = { ativo: false, x: 0, y: 0, inicioX: 0, inicioY: 0, moveu: false, no: null, pointerId: null };

  /* ── D49: worktrees compartilhados e granulado do quadro ─────────────── */
  const compartilhados = new Set(); // worktrees com >1 ocupante confirmado
  let grao = null; // padrão de ruído pré-renderizado (nulo = sem granulado)

  /** Worktrees com ocupação confirmada por mais de um nó (chip duplo). */
  function computarCompartilhados() {
    compartilhados.clear();
    const contagem = new Map();
    for (const o of estado.ocupacaoWorktree || []) {
      if (!o || !o.worktree) continue;
      contagem.set(o.worktree, (contagem.get(o.worktree) || 0) + 1);
    }
    for (const [wt, n] of contagem) {
      if (n > 1) compartilhados.add(wt);
    }
  }

  /** Granulado estático do quadro-negro; regenerado ao redimensionar. */
  function semearGrao() {
    grao = null;
    if (nivelEfeitos() === "desligado") return;
    try {
      if (typeof document === "undefined" || !document.createElement) return;
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(largura / 2));
      c.height = Math.max(1, Math.round(altura / 2));
      const g = c.getContext("2d");
      if (!g) return;
      const img = g.createImageData(c.width, c.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() < 0.5 ? 0 : 255;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 14;
      }
      g.putImageData(img, 0, 0);
      grao = c;
    } catch {
      grao = null;
    }
  }

  function desenharGrao() {
    if (!grao || !ctx.drawImage) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(grao, 0, 0, largura, altura);
    ctx.restore();
  }

  /* ── Onda 1: hover, densidade de efeitos e poeira ambiente ─────────────── */
  let pairado = null;
  const vizinhos = new Set();
  let poeira = [];
  const reduzir =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function nivelEfeitos() {
    const e = estado.preferencias && estado.preferencias.efeitos;
    return e === "sutil" || e === "desligado" ? e : "cheio";
  }

  /** Posição com deriva aplicada (só renderização; a física não vê isso). */
  function posMundo(id, tempo, amp) {
    const p = posicoes.get(id);
    if (!p) return null;
    if (p.camada === "grupo") return {x:p.x,y:p.y};
    const nivel = nivelEfeitos();
    const a = nivel === "desligado" ? 0 : amp * (nivel === "sutil" ? 0.4 : 1);
    if (!a || reduzir || id === arrastando.no) return { x: p.x, y: p.y };
    return {
      x: p.x + deriva(p.fase, tempo, a),
      y: p.y + deriva(p.fase * 1.7 + 0.5, tempo, a),
    };
  }

  function atualizarVizinhos() {
    vizinhos.clear();
    if (!pairado) return;
    vizinhos.add(pairado);
    for (const no of estado.nos || []) {
      if (no.id === pairado && no.grupoPai) vizinhos.add(no.grupoPai);
      if (no.grupoPai === pairado) vizinhos.add(no.id);
    }
    for (const d of estado.dependencias || []) {
      if (d.origem === pairado) vizinhos.add(d.destino);
      if (d.destino === pairado) vizinhos.add(d.origem);
    }
  }

  function pairar(id) {
    if (pairado === id) return;
    pairado = id;
    atualizarVizinhos();
    try {
      canvas.style.cursor = id ? "pointer" : "";
    } catch {
      /* canvas falso nos testes não tem estilo */
    }
  }

  function esmaecido(id) {
    return pairado != null && !vizinhos.has(id);
  }

  function quantPoeira() {
    const nivel = nivelEfeitos();
    if (nivel === "desligado") return 0;
    const teto = nivel === "sutil" ? 25 : 60;
    return Math.max(12, Math.min(teto, Math.round((largura * altura) / 26000)));
  }

  function semearPoeira() {
    const q = quantPoeira();
    while (poeira.length < q) {
      poeira.push({
        x: Math.random() * largura,
        y: Math.random() * altura,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 0.6 + Math.random() * 1.4,
        a: 0.1 + Math.random() * 0.22,
        f: Math.random() * Math.PI * 2,
      });
    }
    poeira.length = q;
  }

  let largura = 0;
  let altura = 0;
  let dpr = 1;

  function redimensionar() {
    const retangulo = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    largura = Math.max(retangulo.width, 1);
    altura = Math.max(retangulo.height, 1);
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
  }

  /* ── Layout: âncoras determinísticas, física em cima delas ─────────────── */

  /** Nós sob um galho recolhido: existem no estado, mas saem de cena. */
  const ocultos = new Set();

  function calcularAncoras() {
    const grupos = estado.grupos || [];
    const nos = estado.nos || [];
    const filhosPorPai = new Map();

    for (const no of nos) {
      const pai = no.grupoPai;
      if (!filhosPorPai.has(pai)) filhosPorPai.set(pai, []);
      filhosPorPai.get(pai).push(no);
    }

    // Grupos em coluna; filhos orbitam o pai em aglomerado radial, como no
    // mockup aprovado — nunca em leque rígido. Âncoras determinísticas
    // (só estrutura + hash) → sem saltos entre atualizações.
    const RAIO_ORBITA = 150;
    const ESPACO_X = 250;
    const ESPACO_Y = 110;
    const espaco = { x: ESPACO_X, y: ESPACO_Y };

    ocultos.clear();
    const marcarOcultos = (id) => {
      ocultos.add(id);
      for (const filho of filhosPorPai.get(id) || []) marcarOcultos(filho.id);
    };

    const visitados = new Set();

    /**
     * Cria ou reposiciona a entrada de um nó. Toda entrada nasce completa —
     * x/y/vx/vy/fase finitos — porque a física e o raio orgânico propagam NaN
     * em silêncio, e nó some da tela sem aviso (regressão já observada).
     * `nascidoEm` só vale na primeira aparição e alimenta a animação de entrada.
     */
    const entrada = (id, x, y) => {
      const novo = !posicoes.has(id);
      const modelo=(estado.nos || []).find(no=>no.id===id);
      const inicial=modelo?.posicaoFixada ? modelo.posicao : null;
      const atual = posicoes.get(id) || {
        x:Number.isFinite(inicial?.x)?inicial.x:x,
        y:Number.isFinite(inicial?.y)?inicial.y:y,vx:0,vy:0,
      };
      visitados.add(id);
      posicoes.set(id, {
        ...atual,
        x: Number.isFinite(atual.x) ? atual.x : x,
        y: Number.isFinite(atual.y) ? atual.y : y,
        vx: Number.isFinite(atual.vx) ? atual.vx : 0,
        vy: Number.isFinite(atual.vy) ? atual.vy : 0,
        fase: Number.isFinite(atual.fase) ? atual.fase : hashNum(id) * Math.PI * 2,
        nascidoEm: novo ? performance.now() : atual.nascidoEm,
        alvoX: x,
        alvoY: y,
        camada: "no",
      });
    };

    const percorrer = (id, x, y, raioOrbita) => {
      const no = nos.find((n) => n.id === id);
      if (!no || visitados.has(id)) return;
      entrada(id, x, y);
      if (no.recolhido) {
        // Recolhido: o nó fica no lugar (com a ficha de contagem); apenas a
        // subárvore abaixo dele sai de cena.
        for (const filho of filhosPorPai.get(id) || []) marcarOcultos(filho.id);
        return;
      }
      const filhos = filhosPorPai.get(id) || [];
      // Órbita completa ao redor do pai; direção inicial estável por hash.
      const inicio = hashNum(id) * Math.PI * 2;
      filhos.forEach((filho, indice) => {
        const a = filhos.length > 1 ? inicio + (indice / filhos.length) * Math.PI * 2 : inicio;
        percorrer(
          filho.id,
          x + Math.cos(a) * raioOrbita,
          y + Math.sin(a) * raioOrbita,
          Math.max(raioOrbita * 0.85, 90),
        );
      });
    };

    grupos.forEach((grupo, indiceGrupo) => {
      const filhoIds = filhosPorPai.get(grupo.id) || [];
      const colunaX = indiceGrupo * espaco.x;
      const baseY = -((filhoIds.length - 1) * espaco.y) / 2;
      const base = posicoes.get(grupo.id) || { x: colunaX, y: baseY, vx: 0, vy: 0 };
      posicoes.set(grupo.id, {
        ...base,
        x: Number.isFinite(base.x) ? base.x : colunaX,
        y: Number.isFinite(base.y) ? base.y : baseY,
        vx: Number.isFinite(base.vx) ? base.vx : 0,
        vy: Number.isFinite(base.vy) ? base.vy : 0,
        alvoX: colunaX,
        alvoY: baseY,
        camada: "grupo",
      });

      filhoIds.forEach((no, indice) => {
        // Irmãos de grupo dividem a órbita ao redor do centro; filho único
        // fica no centro (compacto, sem com quem colidir). Sem isso, todos
        // nasciam na mesma âncora e só a colisão os separaria.
        if (filhoIds.length < 2) {
          percorrer(no.id, colunaX, baseY, RAIO_ORBITA);
          return;
        }
        const a = (indice / filhoIds.length) * Math.PI * 2 + hashNum(grupo.id) * Math.PI * 2;
        percorrer(
          no.id,
          colunaX + Math.cos(a) * RAIO_ORBITA,
          baseY + Math.sin(a) * RAIO_ORBITA,
          RAIO_ORBITA * 0.85,
        );
      });
    });

    // Órfãos: nós sem grupo válido — criados sem origem (`grupoPai: null`, o
    // que o botão "criar chat" produz) ou cujo pai deixou de existir. Sem
    // âncora própria eles nunca seriam desenhados e sumiriam da tela em
    // silêncio, contra D21. Ganham coluna própria após os grupos, com a
    // subárvore preservada.
    const orfaos = nos.filter((n) => !visitados.has(n.id) && !ocultos.has(n.id));
    if (orfaos.length) {
      const colunaX = grupos.length * espaco.x;
      const raizes = orfaos.filter((n) => !nos.some((p) => p.id === n.grupoPai));
      const lista = raizes.length ? raizes : orfaos;
      const altura = lista.length * espaco.y;
      lista.forEach((no, indice) => {
        percorrer(no.id, colunaX, -altura / 2 + indice * espaco.y + espaco.y / 2, RAIO_ORBITA);
      });
      // Ressalva para ciclos ou nós pendurados em órfãos: ainda visíveis.
      let sobra = 0;
      for (const no of orfaos) {
        if (visitados.has(no.id)) continue;
        entrada(no.id, colunaX + espaco.x, -altura / 2 + sobra * espaco.y + espaco.y / 2);
        sobra += 1;
      }
    }
  }

  /** Garante velocidade e fase finitas em toda entrada (defesa em profundidade). */
  function inicializarPosicoes() {
    for (const [id, p] of posicoes) {
      if (!Number.isFinite(p.x)) p.x = p.alvoX;
      if (!Number.isFinite(p.y)) p.y = p.alvoY;
      if (!Number.isFinite(p.vx)) p.vx = 0;
      if (!Number.isFinite(p.vy)) p.vy = 0;
      if (!Number.isFinite(p.fase)) p.fase = hashNum(id) * Math.PI * 2;
    }
  }

  function passoFisica(dt) {
    const corpos = [];
    for (const [id, p] of posicoes) {
      if (p.camada !== "no" || ocultos.has(id)) continue;
      const no = estado.nos.find((n) => n.id === id);
      const base = 26 * (estado.nos.some((n) => n.grupoPai === id) ? 1.15 : 1);
      p.raio = base * 1.3 * 1.085 * 1.09 + 10;
      p.fixo = id === arrastando.no || !!p.entrega;
      const alvoEnergia = energiaDoNo(no, Date.now());
      p.energia = Number.isFinite(p.energia) ? lerp(p.energia, alvoEnergia, 1 - Math.exp(-dt * 0.06)) : alvoEnergia;
      corpos.push(p);
    }
    aplicarRepulsao(corpos, 26, {forca: 0.055 * dt, teto: 2 * dt, respiro: 18});
    for (const [id, p] of posicoes) {
      if (!Number.isFinite(p.x)) p.x = p.alvoX;
      if (!Number.isFinite(p.y)) p.y = p.alvoY;
      if (!Number.isFinite(p.vx)) p.vx = 0;
      if (!Number.isFinite(p.vy)) p.vy = 0;
      const destinoArrasto = id === arrastando.no ? p.alvoArrasto : p.entrega;
      if (destinoArrasto) {
        const fator = reduzir ? 1 : 1 - Math.exp(-dt * 0.34);
        p.x = lerp(p.x, destinoArrasto.x, fator);
        p.y = lerp(p.y, destinoArrasto.y, fator);
        p.vx = 0; p.vy = 0;
        if (id !== arrastando.no && Math.hypot(p.x-destinoArrasto.x,p.y-destinoArrasto.y)<0.08) {
          p.x=destinoArrasto.x; p.y=destinoArrasto.y;
          p.entrega=null; p.fixo=false;
        }
        continue;
      }
      // Grupos não são pinos: seu centro é calculado a partir dos módulos.
      if (p.camada === "grupo") {p.vx=0; p.vy=0; continue;}
      const mola = 0;
      const freio = Math.pow(0.78, dt);
      p.vx = (p.vx + (p.alvoX - p.x) * mola * dt) * freio;
      p.vy = (p.vy + (p.alvoY - p.y) * mola * dt) * freio;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (Math.abs(p.vx) < 0.002) p.vx = 0;
      if (Math.abs(p.vy) < 0.002) p.vy = 0;
    }
    resolverContatos(corpos);
    atualizarCentrosDosGrupos();
    if (organizacaoPendente && !arrastando.ativo && corpos.every(p=>!p.entrega && Math.hypot(p.vx,p.vy)<0.1)) {
      organizacaoPendente=false;
      onOrganizar([...posicoes].filter(([,p])=>p.camada==="no").map(([id,p])=>({id,x:p.x,y:p.y})));
    }
  }

  function atualizarCentrosDosGrupos() {
    for (const grupo of estado.grupos || []) {
      const centro = posicoes.get(grupo.id);
      if (!centro) continue;
      const membros = (estado.nos || [])
        .filter(no => no.grupoPai === grupo.id && !ocultos.has(no.id))
        .map(no => posicoes.get(no.id))
        .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
      if (!membros.length) continue;
      centro.x = membros.reduce((s,p) => s+p.x,0)/membros.length;
      centro.y = membros.reduce((s,p) => s+p.y,0)/membros.length;
      centro.alvoX=centro.x; centro.alvoY=centro.y;
      centro.vx=0; centro.vy=0;
    }
  }

  /**
   * Ponto testável do arrasto (D51): desloca a posição em unidades de mundo.
   * O handler converte o gesto; as posições ficam livres e podem ser persistidas pelo controlador.
   */
  function moverNo(id, dxMundo, dyMundo) {
    const p = posicoes.get(id);
    if (!p || p.camada !== "no") return false;
    if (!Number.isFinite(dxMundo) || !Number.isFinite(dyMundo)) return false;
    p.x += dxMundo;
    p.y += dyMundo;
    return true;
  }

  /* ── Desenho ────────────────────────────────────────────────────────────── */

  function mundoParaTela(x, y) {
    return {
      x: (x - camera.x) * camera.zoom + largura / 2,
      y: (y - camera.y) * camera.zoom + altura / 2,
    };
  }

  /**
   * Perímetro ondulado do blob (D49): curva fechada traçada ponto a ponto com
   * duas harmônicas sobre o ângulo, em vez de `arc` perfeito. É isso que
   * diferencia um blob de um spinner — o contorno nunca é um círculo.
   * Fichas e anéis de seleção continuam em arco de propósito: contraste entre
   * o orgânico vivo e o objeto usinado.
   */
  function tracarBlob(t, raio, tempo, fase) {
    ctx.beginPath();
    const N = 28;
    for (let i = 0; i <= N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      const w =
        1 +
        0.055 * Math.sin(3 * a + fase + tempo * 0.0011) +
        0.035 * Math.sin(5 * a - fase * 1.3 + tempo * 0.0017);
      const x = t.x + Math.cos(a) * raio * w;
      const y = t.y + Math.sin(a) * raio * w;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function telaParaMundo(x, y) {
    return {
      x: (x - largura / 2) / camera.zoom + camera.x,
      y: (y - altura / 2) / camera.zoom + camera.y,
    };
  }

  function pontoDaCurva(curva, t) {
    const u=1-t, {a,c1,c2,b}=curva;
    return {x:u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x,
      y:u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y};
  }

  function geometriasDasConexoes(tempo=ultimo) {
    const descritores=new Map();
    for (const no of estado.nos || []) {
      if (no.grupoPai) descritores.set(`ramo:${no.id}`,{
        id:`ramo:${no.id}`,de:no.grupoPai,para:no.id,
        tipo:no.conexaoPai ? "Ramificação de conexão" : "Vínculo organizacional",
        conexaoPai:no.conexaoPai,
      });
    }
    for (const dep of estado.dependencias || []) {
      const id=`dep:${dep.origem}>${dep.destino}`;
      descritores.set(id,{id,de:dep.origem,para:dep.destino,tipo:"Dependência"});
    }
    const prontas=new Map(), calculando=new Set();
    const resolver=id=>{
      if (prontas.has(id)) return prontas.get(id);
      const d=descritores.get(id);
      if (!d || calculando.has(id) || destinoForaDeCena(d.de,d.para)) return null;
      calculando.add(id);
      let a;
      if (d.conexaoPai) {
        const pai=resolver(d.conexaoPai.id);
        if (pai) a=pontoDaCurva(pai,Math.max(0.08,Math.min(0.92,d.conexaoPai.t??0.5)));
      } else a=posMundo(d.de,tempo,ampDeriva(estadoDeId(d.de)));
      const b=posMundo(d.para,tempo,ampDeriva(estadoDeId(d.para)));
      calculando.delete(id);
      if (!a || !b) return null;
      const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;
      const curvatura=Math.min(26/camera.zoom,dist*0.08);
      const curva={...d,a,b,
        c1:{x:a.x+dx*0.32-dy/dist*curvatura,y:a.y+dy*0.22+dx/dist*curvatura},
        c2:{x:a.x+dx*0.68-dy/dist*curvatura,y:a.y+dy*0.78+dx/dist*curvatura},
      };
      prontas.set(id,curva);return curva;
    };
    for (const id of descritores.keys()) resolver(id);
    return [...prontas.values()];
  }

  function infoDaConexao(curva,t=0.5) {
    const ponto=pontoDaCurva(curva,t);
    const anterior=pontoDaCurva(curva,Math.max(0,t-0.01));
    const seguinte=pontoDaCurva(curva,Math.min(1,t+0.01));
    const dx=seguinte.x-anterior.x,dy=seguinte.y-anterior.y;
    const tamanho=Math.hypot(dx,dy)||1;
    let comprimento=0,p=curva.a;
    for (let i=1;i<=40;i++) {const q=pontoDaCurva(curva,i/40);comprimento+=Math.hypot(q.x-p.x,q.y-p.y);p=q;}
    return {id:curva.id,de:curva.de,para:curva.para,tipo:curva.tipo,conexaoPai:curva.conexaoPai,
      t,x:ponto.x,y:ponto.y,nx:-dy/tamanho,ny:dx/tamanho,comprimento};
  }

  function conexaoEm(x,y) {
    const tolerancia=window.matchMedia?.("(pointer: coarse)").matches ? 20 : 10;
    let melhor=null, distanciaMelhor=tolerancia;
    for (const curva of geometriasDasConexoes()) {
      if(ocultos.has(curva.de)||ocultos.has(curva.para))continue;
      let anterior=mundoParaTela(curva.a.x,curva.a.y);
      for (let i=1;i<=64;i++) {
        const ponto=pontoDaCurva(curva,i/64);
        const atual=mundoParaTela(ponto.x,ponto.y);
        const dx=atual.x-anterior.x,dy=atual.y-anterior.y;
        const u=Math.max(0,Math.min(1,((x-anterior.x)*dx+(y-anterior.y)*dy)/(dx*dx+dy*dy||1)));
        const d=Math.hypot(x-anterior.x-u*dx,y-anterior.y-u*dy);
        if (d<distanciaMelhor) {distanciaMelhor=d;melhor=infoDaConexao(curva,(i-1+u)/64);}
        anterior=atual;
      }
    }
    return melhor;
  }

  function selecionarConexao(id,t=0.5) {
    const curva=geometriasDasConexoes().find(c=>c.id===id);
    if (!curva || ocultos.has(curva.de) || ocultos.has(curva.para)) return null;
    selecionado=null; conexaoSelecionada=id;
    const info=infoDaConexao(curva,Math.max(0.08,Math.min(0.92,t)));
    onSelecionarConexao(info);
    return info;
  }

  function desenharGalhos(tempo) {
    const curvas=geometriasDasConexoes(tempo);
    const tracar=c=>{
      const a=mundoParaTela(c.a.x,c.a.y),b=mundoParaTela(c.b.x,c.b.y);
      const c1=mundoParaTela(c.c1.x,c.c1.y),c2=mundoParaTela(c.c2.x,c.c2.y);
      ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,b.x,b.y);
    };
    ctx.save();ctx.setLineDash([]);ctx.lineCap="round";ctx.lineJoin="round";ctx.shadowBlur=0;
    ctx.lineWidth=Math.max(2,Math.min(3.2,2.6*camera.zoom));
    const nivelDe=c=>Math.round(Math.min(posicoes.get(c.de)?.visibilidade??1,posicoes.get(c.para)?.visibilidade??1)*12);
    for(let nivel=1;nivel<=12;nivel++) {
      const lote=curvas.filter(c=>nivelDe(c)===nivel);
      if(!lote.length)continue;
      ctx.strokeStyle=`rgba(${GIZ}, ${0.58*nivel/12})`;ctx.beginPath();
      for (const curva of lote) tracar(curva);
      ctx.stroke();
      const realces=lote.filter(c=>c.id===conexaoSelecionada || c.id===conexaoPairada);
      if (realces.length) {
        ctx.strokeStyle=`rgba(${GIZ}, ${0.95*nivel/12})`;ctx.beginPath();
        for (const curva of realces) tracar(curva);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function destinoForaDeCena(de, para) {
    const destino = posicoes.get(para);
    if (!destino) return true;
    if (destino.camada !== "no") return true;
    // Galho recolhido esconde a subárvore — a aresta também sai de cena.
    if ((ocultos.has(de) && (posicoes.get(de)?.visibilidade??0)<0.002) ||
        (ocultos.has(para) && (destino.visibilidade??0)<0.002)) return true;
    return false;
  }

  function estadoDeId(id) {
    const no = (estado.nos || []).find((n) => n.id === id);
    const vivoAtual = vivo[id];
    return vivoAtual?.estado || no?.estado || ESTADO.VAZIO;
  }

  function desenharDependencias(tempo) {
    // Incluídas no mesmo traçado uniforme dos galhos.
  }

  function estadoVisual(no) {
    const vivoAtual = vivo[no.id];
    const estado = vivoAtual?.estado || no.estado || ESTADO.VAZIO;
    return { estado, detalhe: vivoAtual?.detalhe || "" };
  }

  /**
   * Energia do nó (D52): ativo vale 1; os demais decaem do último instante
   * conhecido até o piso do estado em ~2 min. Só recência, nunca conteúdo.
   */
  function energiaDoNo(no, tempo) {
    const vivoAtual = vivo[no.id];
    const estado = vivoAtual?.estado || no.estado || ESTADO.VAZIO;
    if (estado === ESTADO.ATIVO) return 1;
    const piso = estado === ESTADO.DORMENTE ? 0.35 : 0.2;
    const desde = vivoAtual?.desde;
    if (!Number.isFinite(desde)) return piso;
    const idade = Math.max(tempo - desde, 0);
    return piso + (1 - piso) * Math.exp(-idade / 45000);
  }

  function desenharGrupo(grupo, tempo) {
    const p = posicoes.get(grupo.id);
    if (!p) return;
    const filhos = (estado.nos || []).filter((n) => n.grupoPai === grupo.id);
    const centro = mundoParaTela(p.x, p.y);

    let raio = 70 * camera.zoom;
    for (const filho of filhos) {
      const fp = posicoes.get(filho.id);
      if (!fp) continue;
      const f = mundoParaTela(fp.x, fp.y);
      raio = Math.max(raio, Math.hypot(f.x - centro.x, f.y - centro.y) + 70 * camera.zoom);
    }
    raio = Math.min(raio, 620 * camera.zoom);

    ctx.save();
    if (esmaecido(grupo.id)) ctx.globalAlpha = 0.25;
    // Fusão aditiva: territórios e brilhos vizinhos se fundem como um organismo (D52).
    ctx.globalCompositeOperation = "lighter";
    const gradiente = ctx.createRadialGradient(centro.x, centro.y, raio * 0.2, centro.x, centro.y, raio);
    gradiente.addColorStop(0, `rgba(${GIZ}, 0.10)`);
    gradiente.addColorStop(0.75, `rgba(${GIZ}, 0.05)`);
    gradiente.addColorStop(1, `rgba(${GIZ}, 0)`);
    ctx.fillStyle = gradiente;
    ctx.beginPath();
    ctx.ellipse(centro.x, centro.y, raio, raio * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    // Contorno esboçado do território: traço duplo de giz.
    ctx.strokeStyle = `rgba(${GIZ}, 0.28)`;
    ctx.lineWidth = 1.2 * camera.zoom;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(${GIZ}, 0.12)`;
    ctx.beginPath();
    ctx.ellipse(centro.x, centro.y, raio * 0.94, raio * 0.77, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Título em serifa vintage com o naipe do papel (D49), espaçado (D53).
    const naipe = naipeDe(grupo.papel);
    ctx.fillStyle = "rgba(235, 232, 224, 0.88)";
    ctx.font = `500 ${Math.max(12, Math.round(14 * camera.zoom))}px ${SERIFA}`;
    ctx.textAlign = "center";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.fillText(naipe ? `${grupo.titulo} ${naipe}` : grupo.titulo, centro.x, centro.y - raio * 0.82 - 10 * camera.zoom);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  }

  function desenharNo(no, tempo) {
    const p = posicoes.get(no.id);
    if (!p || p.camada !== "no") return;
    // Recolhido: a subárvore existe no estado, mas não é desenhada.
    const visibilidade=p.visibilidade??1;
    if (visibilidade<0.002) return;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const { estado: estadoNo } = estadoVisual(no);
    const centro = posMundo(no.id, tempo, ampDeriva(estadoNo));
    if (!centro) return;
    const t = mundoParaTela(centro.x, centro.y);
    // Hover fora da vizinhança esmaece (padrão Obsidian); o par não some.
    const dim = esmaecido(no.id);
    ctx.save();
    ctx.globalAlpha=(dim?0.22:1)*visibilidade;
    // Nascer com escala: criação de chat tem retorno visual imediato (D02).
    const idade = ultimo - (Number.isFinite(p.nascidoEm) ? p.nascidoEm : ultimo);
    const fracaoEntrada = reduzir || nivelEfeitos() === "desligado" || idade < 0 ? 1 : Math.min(1, idade / 320);
    const escalaEntrada = 1 - (1 - fracaoEntrada) * (1 - fracaoEntrada) * (1 - fracaoEntrada);
    const raioBase = 26 * camera.zoom * ((estado.nos || []).some((n) => n.grupoPai === no.id) ? 1.15 : 1);
    // Tamanho por atividade (D52): o blob cresce trabalhando e murcha parado.
    const raio = raioOrganico(reduzir || nivelEfeitos() === "desligado" ? 0 : tempo * 0.65, p.fase, raioBase) * escalaEntrada * (0.82 + visibilidade*0.18) * (0.85 + 0.45 * (p.energia ?? energiaDoNo(no, Date.now())));

    // Giz monocromático (D49): o estado mora em textura + contorno + brilho.
    let alfa = 1;
    let brilho = 0;
    let alfaTraco = 0.9;
    let alfaHachura = 0;
    let passoHachura = 0;
    let cruzada = false;

    if (estadoNo === ESTADO.ATIVO) {
      brilho = reduzir || nivelEfeitos() === "desligado" ? 0.3 : 0.35 + 0.13 * Math.sin(tempo * 0.0018 + p.fase);
      alfaHachura = 0.26;
      passoHachura = 7 * camera.zoom;
    } else if (estadoNo === ESTADO.DORMENTE) {
      alfa = 0.72;
      alfaTraco = 0.55;
      alfaHachura = 0.13;
      passoHachura = 11 * camera.zoom;
    } else if (estadoNo === ESTADO.VAZIO) {
      alfa = 0.55;
      alfaTraco = 0.45;
    } else if (estadoNo === ESTADO.NAO_ENCONTRADO) {
      alfa = 0.5;
      alfaTraco = 0.6;
      alfaHachura = 0.2;
      passoHachura = 8 * camera.zoom;
      cruzada = true; // hachura em X: sessão cortada, mas nó preservado (D21)
    } else if (estadoNo === ESTADO.INCERTO) {
      alfa = 0.75 + 0.2 * Math.sin(tempo * 0.012 + p.fase);
      alfaTraco = 0.7;
      alfaHachura = 0.15;
      passoHachura = 9 * camera.zoom;
    }

    // Aura de giz para o estado ativo (aditiva: funde com vizinhos, D52).
    if (brilho > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = `rgba(${GIZ}, ${brilho})`;
      ctx.shadowBlur = 44 * camera.zoom;
      ctx.fillStyle = `rgba(20, 24, 32, ${alfa})`;
      tracarBlob(t, raio, tempo, p.fase);
      ctx.fill();
      ctx.restore();
    }

    const vazio = estadoNo === ESTADO.VAZIO;

    if (!vazio) {
      // Corpo: giz escuro com topo iluminado, sem cor por papel.
      const gradiente = ctx.createRadialGradient(
        t.x - raio * 0.35,
        t.y - raio * 0.4,
        raio * 0.15,
        t.x,
        t.y,
        raio,
      );
      gradiente.addColorStop(0, `rgba(52, 58, 70, ${alfa})`);
      gradiente.addColorStop(1, `rgba(16, 20, 28, ${alfa})`);
      ctx.fillStyle = gradiente;
      tracarBlob(t, raio, tempo, p.fase);
      ctx.fill();
    }

    // Hachura do estado, recortada no blob e com direção estável por nó
    // (efeito desligado ou nó vazio = sem relevo).
    if (!vazio && passoHachura > 0 && nivelEfeitos() !== "desligado" && ctx.clip) {
      ctx.save();
      tracarBlob(t, raio * 0.96, tempo, p.fase);
      ctx.clip();
      ctx.translate(t.x, t.y);
      const giro = -Math.PI / 4 + (hashNum(no.id) - 0.5) * 0.7;
      ctx.rotate(cruzada ? giro + Math.PI / 4 : giro);
      ctx.strokeStyle = `rgba(${GIZ}, ${alfaHachura})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let d = -raio * 1.5; d <= raio * 1.5; d += passoHachura) {
        ctx.moveTo(-raio * 1.5, d);
        ctx.lineTo(raio * 1.5, d);
      }
      if (cruzada) {
        ctx.rotate(Math.PI / 2);
        for (let d = -raio * 1.5; d <= raio * 1.5; d += passoHachura) {
          ctx.moveTo(-raio * 1.5, d);
          ctx.lineTo(raio * 1.5, d);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Contorno esboçado: traço triplo sobre o próprio perímetro ondulado.
    const tremor = (hashNum(`${no.id}:traco`) - 0.5) * 2.4 * camera.zoom;
    const tracejados = {
      [ESTADO.VAZIO]: [4, 5],
      [ESTADO.INCERTO]: [2, 4],
      [ESTADO.NAO_ENCONTRADO]: [5, 4],
    };
    ctx.lineWidth = (vazio ? 1.6 : 2) * camera.zoom;
    if (tracejados[estadoNo]) ctx.setLineDash(tracejados[estadoNo]);
    else ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(${GIZ}, ${alfaTraco})`;
    for (const delta of [1.5 * camera.zoom, 2.9 * camera.zoom + tremor * 0.3, 0.1 * camera.zoom + tremor * 0.3]) {
      tracarBlob(t, Math.max(raio + delta, 1), tempo, p.fase);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Seleção
    if (selecionado === no.id || arrastando.no === no.id) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.6 * camera.zoom;
      ctx.beginPath();
      ctx.arc(t.x, t.y, raio + 7 * camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Hover: anel pulsante que marca o par sob o cursor.
    if (pairado === no.id) {
      const pulso = 10 + (reduzir || nivelEfeitos() === "desligado" ? 0 : 1.5 * Math.sin(tempo * 0.0025 + p.fase));
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 1.4 * camera.zoom;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(t.x, t.y, raio + pulso * camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Recolhido: ficha de pôquer com a contagem no centro (D49).
    const filhos = (estado.nos || []).filter((n) => n.grupoPai === no.id);
    if (filhos.length) {
      const fx = t.x + raio * 0.78;
      const fy = t.y - raio * 0.78;
      const fr = 8 * camera.zoom;
      ctx.fillStyle = "rgba(14, 17, 24, 0.92)";
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fill();
      // Borda da ficha: 8 marcas no aro.
      ctx.strokeStyle = `rgba(${GIZ}, 0.9)`;
      ctx.lineWidth = 1.4 * camera.zoom;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx, fy, fr * 0.68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        ctx.moveTo(fx + Math.cos(a) * fr * 0.68, fy + Math.sin(a) * fr * 0.68);
        ctx.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(235, 232, 224, 0.95)";
      ctx.font = `${Math.round(11 * camera.zoom)}px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        no.recolhido ? String(filhos.length) : "–",
        fx,
        fy + 0.5,
      );
    }

    // Worktree vinculado: ficha pequena; compartilhado confirmado = ficha dupla (D49).
    if (no.worktree && camera.zoom > 0.45) {
      const wx = t.x - raio * 0.78;
      const wy = t.y + raio * 0.78;
      const wr = 6 * camera.zoom;
      const duplo = compartilhados.has(no.worktree);
      if (duplo) {
        ctx.fillStyle = "rgba(14, 17, 24, 0.92)";
        ctx.beginPath();
        ctx.arc(wx - 3 * camera.zoom, wy - 3 * camera.zoom, wr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${GIZ}, 0.55)`;
        ctx.lineWidth = 1.2 * camera.zoom;
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(14, 17, 24, 0.92)";
      ctx.beginPath();
      ctx.arc(wx, wy, wr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(${GIZ}, 0.9)`;
      ctx.lineWidth = 1.2 * camera.zoom;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(wx, wy, wr * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Estampa central, como a marca de uma bola de bilhar.
    const naipe = naipeDe(no.papel);
    if (naipe && raio > 0.5) {
      ctx.save();
      ctx.shadowBlur = 0;
      const estampa = raio * 0.62;
      ctx.beginPath();
      ctx.arc(t.x, t.y, estampa, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(235, 232, 224, 0.97)";
      ctx.fill();
      ctx.fillStyle = "#171b16";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.max(1, raio * 1.03)}px "Segoe UI Symbol", "DejaVu Sans", serif`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      ctx.fillText(naipe, t.x, t.y + raio * 0.025, estampa * 1.5);
      ctx.restore();
    }
    // O título continua fora da esfera; a função fica estampada no centro.
    if (camera.zoom > 0.45 || pairado === no.id || selecionado === no.id || arrastando.no === no.id) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(235, 232, 224, 0.95)";
      ctx.font = `${Math.max(14, Math.round(14 * camera.zoom))}px ${SERIFA}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      const base = no.titulo.length > 32 ? `${no.titulo.slice(0, 31)}…` : no.titulo;
      const titulo = base;
      ctx.save();
      ctx.shadowColor = `rgba(${GIZ}, 0.45)`;
      ctx.shadowBlur = 5 * camera.zoom;
      ctx.fillText(titulo, t.x, t.y + raio + 7 * camera.zoom);
      ctx.restore();

      const sub = [];
      if (no.diretorio) sub.push(no.diretorio);
      if (no.worktree) sub.push("worktree");
      if (sub.length && camera.zoom > 0.7) {
        ctx.fillStyle = "rgba(160, 172, 190, 0.9)";
        ctx.font = `${Math.round(10.5 * camera.zoom)}px ${SANS}`;
        ctx.fillText(sub.join(" · "), t.x, t.y + raio + 22 * camera.zoom);
      }
    }
    ctx.restore();
  }

  function desenharPoeira(tempo) {
    if (!poeira.length) return;
    ctx.save();
    for (const g of poeira) {
      const cintilar = 0.55 + 0.45 * Math.sin(tempo * 0.0011 + g.f);
      ctx.globalAlpha = g.a * cintilar;
      ctx.fillStyle = `rgba(${GIZ}, 1)`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function desenharVinheta() {
    const cx = largura / 2;
    const cy = altura / 2;
    const vinheta = ctx.createRadialGradient(
      cx, cy, Math.min(largura, altura) * 0.42,
      cx, cy, Math.max(largura, altura) * 0.75,
    );
    vinheta.addColorStop(0, "rgba(0, 0, 0, 0)");
    vinheta.addColorStop(1, "rgba(0, 0, 0, 0.32)");
    ctx.fillStyle = vinheta;
    ctx.fillRect(0, 0, largura, altura);
  }

  function passoPoeira(dt) {
    if (reduzir || nivelEfeitos() === "desligado") return;
    for (const g of poeira) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (g.x < -4) g.x = largura + 4;
      if (g.x > largura + 4) g.x = -4;
      if (g.y < -4) g.y = altura + 4;
      if (g.y > altura + 4) g.y = -4;
    }
  }

  function desenhar(tempo) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    // Fundo com manchas suaves, para não parecer diagrama estático.
    const fundo = ctx.createLinearGradient(0, 0, largura, altura);
    fundo.addColorStop(0, "#10110f");
    fundo.addColorStop(1, "#1a1c18");
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, largura, altura);

    // Movimento reduzido congela o tempo dos efeitos (estático, mas legível).
    const T = reduzir || nivelEfeitos() === "desligado" ? 0 : tempo;

    desenharPoeira(T);
    desenharGrao();

    ctx.save();
    ctx.globalAlpha = 0.5;
    for (const grupo of estado.grupos || []) desenharGrupo(grupo, T);
    ctx.restore();

    desenharDependencias(T);
    desenharGalhos(T);
    for (const no of estado.nos || []) desenharNo(no, T);
    desenharVinheta();
  }

  let ultimo = 0;
  function laco(tempo) {
    const dt = ultimo ? Math.min((tempo - ultimo) / 16.666, 3) : 1;
    ultimo = tempo;

    const suavidade = reduzir ? 1 : 1 - Math.exp(-dt * 0.11);
    camera.x = lerp(camera.x, camera.alvoX, suavidade);
    camera.y = lerp(camera.y, camera.alvoY, suavidade);
    camera.zoom = lerp(camera.zoom, camera.alvoZoom, suavidade);

    for (const [id,p] of posicoes) {
      if (p.camada!=="no") continue;
      const alvo=ocultos.has(id)?0:1;
      const fator=reduzir || nivelEfeitos()==="desligado" ? 1 : 1-Math.exp(-dt*0.22);
      p.visibilidade=lerp(p.visibilidade??1,alvo,fator);
      if(Math.abs(p.visibilidade-alvo)<0.002)p.visibilidade=alvo;
    }
    const subpassos = Math.max(1, Math.ceil(dt * 2));
    for (let i = 0; i < subpassos; i++) passoFisica(dt / subpassos);
    passoPoeira(dt);
    try {
      desenhar(tempo);
    } catch (erro) {
      onErro(erro);
      return; // Sem spam por quadro e sem falha silenciosa que apaga a tela.
    }
    requestAnimationFrame(laco);
  }

  /* ── Interação ──────────────────────────────────────────────────────────── */

  function noEm(x, y) {
    const mundo = telaParaMundo(x, y);
    // Do topo (último desenhado) para baixo.
    for (let i = (estado.nos || []).length - 1; i >= 0; i -= 1) {
      const no = estado.nos[i];
      if (ocultos.has(no.id)) continue;
      const p = posicoes.get(no.id);
      if (!p || p.camada !== "no") continue;
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const centro = posMundo(no.id, ultimo, ampDeriva(estadoDeId(no.id)));
      const base = 26 * (estado.nos.some((n) => n.grupoPai === no.id) ? 1.15 : 1);
      const raio = base * (0.85 + 0.45 * (p.energia ?? 1)) * 1.1 + 5;
      if (Math.hypot(centro.x - mundo.x, centro.y - mundo.y) <= raio) return no;
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (evento) => {
    if (evento.button !== 0 || arrastando.ativo) return;
    arrastando.ativo = true;
    arrastando.moveu = false;
    arrastando.x = evento.clientX;
    arrastando.y = evento.clientY;
    arrastando.inicioX = evento.clientX;
    arrastando.inicioY = evento.clientY;
    arrastando.pointerId = evento.pointerId;
    // Caiu num nó: modo arrasto-de-nó (D51); caiu no vazio: pan da câmera.
    const retangulo = canvas.getBoundingClientRect();
    const no = noEm(evento.clientX - retangulo.left, evento.clientY - retangulo.top);
    arrastando.no = no ? no.id : null;
    arrastando.conexao = no ? null : conexaoEm(evento.clientX-retangulo.left,evento.clientY-retangulo.top);
    if (no) {
      const p = posicoes.get(no.id);
      p.alvoArrasto = {x:p.x,y:p.y};
      p.entrega = null;
      p.vx=0; p.vy=0;
    }
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture(evento.pointerId);
  });

  canvas.addEventListener("pointermove", (evento) => {
    if (!arrastando.ativo) {
      // Sem arrastar, o movimento vira hover: realça a vizinhança.
      const retangulo = canvas.getBoundingClientRect();
      const no = noEm(evento.clientX - retangulo.left, evento.clientY - retangulo.top);
      pairar(no ? no.id : null);
      conexaoPairada=no ? null : conexaoEm(evento.clientX-retangulo.left,evento.clientY-retangulo.top)?.id ?? null;
      canvas.style.cursor=conexaoPairada ? "pointer" : no ? "grab" : "";
      return;
    }
    if (evento.pointerId !== arrastando.pointerId) return;
    const dx = evento.clientX - arrastando.x;
    const dy = evento.clientY - arrastando.y;
    if (Math.hypot(evento.clientX - arrastando.inicioX, evento.clientY - arrastando.inicioY) > 3) arrastando.moveu = true;
    arrastando.x = evento.clientX;
    arrastando.y = evento.clientY;
    if (arrastando.no) {
      // O cursor move o destino; o corpo desliza suavemente até ele.
      const p = posicoes.get(arrastando.no);
      if (p?.alvoArrasto) {
        p.alvoArrasto.x += dx / camera.zoom;
        p.alvoArrasto.y += dy / camera.zoom;
      }
      return;
    }
    camera.alvoX -= dx / camera.zoom;
    camera.alvoY -= dy / camera.zoom;
  });

  function liberarArrasto(evento, cancelado = false) {
    if (!arrastando.ativo || evento.pointerId !== arrastando.pointerId) return;
    arrastando.ativo = false;
    // Soltar deixa o módulo na nova posição, sem retorno à origem.
    const solto = posicoes.get(arrastando.no);
    if (arrastando.no && arrastando.moveu && solto) {
      solto.entrega = cancelado ? null : {...solto.alvoArrasto};
      if (!cancelado) organizacaoPendente=true;
      solto.alvoArrasto = null;
      solto.vx = 0;
      solto.vy = 0;
    }
    arrastando.no = null;
    arrastando.pointerId = null;
    canvas.style.cursor = pairado ? "grab" : "";
    if (canvas.hasPointerCapture(evento.pointerId)) canvas.releasePointerCapture(evento.pointerId);
    if (arrastando.moveu || cancelado) {arrastando.conexao=null;return;}
    if (arrastando.conexao) {
      const info=arrastando.conexao;arrastando.conexao=null;
      selecionarConexao(info.id,info.t);return;
    }
    conexaoSelecionada=null;
    const retangulo = canvas.getBoundingClientRect();
    const no = noEm(evento.clientX - retangulo.left, evento.clientY - retangulo.top);
    selecionado = no ? no.id : null;
    onSelecionar(no);
  }
  canvas.addEventListener("pointerup", (evento) => liberarArrasto(evento));
  canvas.addEventListener("pointercancel", (evento) => liberarArrasto(evento, true));
  canvas.addEventListener("lostpointercapture", (evento) => liberarArrasto(evento, true));
  canvas.addEventListener("pointerleave", () => { if (!arrastando.ativo) {pairar(null);conexaoPairada=null;} });

  canvas.addEventListener(
    "wheel",
    (evento) => {
      evento.preventDefault();
      const retangulo = canvas.getBoundingClientRect();
      const antes = telaParaMundo(evento.clientX - retangulo.left, evento.clientY - retangulo.top);
      const fator = evento.deltaY > 0 ? 0.9 : 1.1;
      camera.alvoZoom = Math.min(2.4, Math.max(0.25, camera.alvoZoom * fator));
      const depois = telaParaMundo(evento.clientX - retangulo.left, evento.clientY - retangulo.top);
      camera.alvoX += antes.x - depois.x;
      camera.alvoY += antes.y - depois.y;
    },
    { passive: false },
  );

  canvas.addEventListener("dblclick", (evento) => {
    const retangulo = canvas.getBoundingClientRect();
    const no = noEm(evento.clientX - retangulo.left, evento.clientY - retangulo.top);
    if (no) focar(no.id);
  });

  canvas.addEventListener("contextmenu", (evento) => {
    const retangulo = canvas.getBoundingClientRect();
    const no = noEm(evento.clientX - retangulo.left, evento.clientY - retangulo.top);
    if (!no) return;
    evento.preventDefault();
    onAcao("menu", no);
  });

  /* ── API pública ───────────────────────────────────────────────────────── */

  function definirEstado(novo, novoVivo) {
    estado = novo || estado;
    if (novoVivo) vivo = novoVivo;
    const idsValidos = new Set([
      ...(estado.grupos || []).map((g) => g.id),
      ...(estado.nos || []).map((n) => n.id),
    ]);
    for (const id of [...posicoes.keys()]) {
      if (!idsValidos.has(id)) posicoes.delete(id);
    }
    if (pairado != null && !idsValidos.has(pairado)) pairar(null);
    else atualizarVizinhos();
    calcularAncoras();
    inicializarPosicoes();
    atualizarCentrosDosGrupos();
    computarCompartilhados();
    semearPoeira();
    semearGrao();
  }

  function definirVivo(novoVivo) {
    vivo = novoVivo || {};
  }

  function focar(id) {
    const p = posicoes.get(id);
    if (!p) return;
    camera.alvoX = p.x;
    camera.alvoY = p.y;
    camera.alvoZoom = Math.max(camera.alvoZoom, 1);
  }

  function centrar() {
    const visiveis = [...posicoes].filter(([id, p]) => p.camada === "no" && !ocultos.has(id)).map(([, p]) => p);
    if (!visiveis.length) return;
    const xs = visiveis.map((p) => p.x); const ys = visiveis.map((p) => p.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    camera.alvoX = (minX + maxX) / 2;
    // Reservar topo para os controles e rodapé para legenda, corpo e títulos.
    camera.alvoZoom = Math.max(0.25, Math.min(1, (largura - (opcoes.margemX ?? 200)) / Math.max(160, maxX - minX), (altura - (opcoes.margemY ?? 310)) / Math.max(160, maxY - minY)));
    camera.alvoY = (minY + maxY) / 2 - 5 / camera.alvoZoom;
  }

  function aplicarZoom(fator) {
    camera.alvoZoom = Math.min(2.4, Math.max(0.25, camera.alvoZoom * fator));
  }

  function ajustar() {
    redimensionar();
    semearPoeira();
    semearGrao();
  }

  redimensionar();
  semearPoeira();
  semearGrao();
  window.addEventListener("resize", ajustar);
  if (typeof ResizeObserver === "function") {
    const observador = new ResizeObserver(ajustar);
    observador.observe(canvas);
  }
  requestAnimationFrame(laco);

  return {
    definirEstado,
    definirVivo,
    focar,
    centrar,
    aplicarZoom,
    pairar,
    moverNo,
    nivelEfeitos,
    efeitosInfo: () => ({ nivel: nivelEfeitos(), poeira: poeira.length, pairado }),
    /** Somente leitura, para testes: cópia das posições atuais. */
    _debugPosicoes: () => [...posicoes].map(([id, p]) => ({ id, x: p.x, y: p.y, camada: p.camada, visibilidade:p.visibilidade??1 })),
    conexoes: () => geometriasDasConexoes().filter(c=>!ocultos.has(c.de)&&!ocultos.has(c.para)).map(c=>infoDaConexao(c)),
    selecionarConexao,
    pontoConexao: (id,t=0.5) => {
      const c=geometriasDasConexoes().find(c=>c.id===id);
      return c ? infoDaConexao(c,t) : null;
    },
    selecionar: (id) => {
      conexaoSelecionada=null;
      selecionado = id;
    },
    camera: () => ({ ...camera }),
  };
}
