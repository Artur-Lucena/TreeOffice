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

const COR_PAPEL = {
  lideranca: "#7cc4ff",
  execucao: "#7ee0b8",
  investigacao: "#ffb86b",
  estudo: "#c9a7ff",
  livre: "#9aa4b2",
};

function hueFromId(id) {
  let h = 0;
  const texto = String(id);
  for (let i = 0; i < texto.length; i += 1) h = (h * 31 + texto.charCodeAt(i)) & 0xffff;
  return h % 360;
}

function hashNum(id) {
  let h = 0;
  const texto = String(id);
  for (let i = 0; i < texto.length; i += 1) h = (h * 31 + texto.charCodeAt(i)) & 0xffff;
  return (h % 1000) / 1000;
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
  const onAcao = opcoes.onAcao || (() => {});

  let estado = { grupos: [], nos: [], dependencias: [], preferencias: {} };
  let vivo = {};
  let selecionado = null;

  const camera = { x: 0, y: 0, zoom: 0.75, alvoX: 0, alvoY: 0, alvoZoom: 0.75 };
  const posicoes = new Map(); // id → {x, y, vx, vy, fase, alvoX, alvoY, camada}
  const arrastando = { ativo: false, x: 0, y: 0, moveu: false };

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
    const nivel = nivelEfeitos();
    const a = nivel === "desligado" ? 0 : amp * (nivel === "sutil" ? 0.4 : 1);
    if (!a || reduzir) return { x: p.x, y: p.y };
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

    // Grupos em coluna; nós de cada grupo em leque vertical; filhos de nó em
    // leque horizontal. Âncoras estáveis → sem saltos entre atualizações.
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
      const atual = posicoes.get(id) || { x, y, vx: 0, vy: 0 };
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

    const percorrer = (id, deslocamentoX, y) => {
      const no = nos.find((n) => n.id === id);
      if (!no) return;
      if (no.recolhido) {
        // Recolhido: o nó fica no lugar (com o selo de contagem); apenas a
        // subárvore abaixo dele sai de cena.
        entrada(id, deslocamentoX, y);
        for (const filho of filhosPorPai.get(id) || []) marcarOcultos(filho.id);
        return;
      }
      const filhos = filhosPorPai.get(id) || [];
      const filhosVisiveis = filhos.filter((f) => !f.recolhido);
      entrada(id, deslocamentoX, y);
      filhosVisiveis.forEach((filho, indice) => {
        percorrer(
          filho.id,
          deslocamentoX + espaco.x,
          y + (indice - (filhosVisiveis.length - 1) / 2) * espaco.y,
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
        percorrer(no.id, colunaX, baseY + (indice - (filhoIds.length - 1) / 2) * espaco.y);
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
        percorrer(no.id, colunaX, -altura / 2 + indice * espaco.y + espaco.y / 2);
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
    const amortecimento = 0.86;
    const atracao = 0.045;

    for (const [id, p] of posicoes) {
      // Defesa: entrada incompleta viraria NaN e apagaria o nó da tela.
      if (!Number.isFinite(p.x)) p.x = p.alvoX;
      if (!Number.isFinite(p.y)) p.y = p.alvoY;
      if (!Number.isFinite(p.vx)) p.vx = 0;
      if (!Number.isFinite(p.vy)) p.vy = 0;
      const dx = p.alvoX - p.x;
      const dy = p.alvoY - p.y;
      p.vx = (p.vx + dx * atracao) * amortecimento;
      p.vy = (p.vy + dy * atracao) * amortecimento;
      p.x += p.vx * Math.min(dt, 3);
      p.y += p.vy * Math.min(dt, 3);
      if (Math.abs(p.vx) < 0.0008) p.vx = 0;
      if (Math.abs(p.vy) < 0.0008) p.vy = 0;
    }
  }

  /* ── Desenho ────────────────────────────────────────────────────────────── */

  function mundoParaTela(x, y) {
    return {
      x: (x - camera.x) * camera.zoom + largura / 2,
      y: (y - camera.y) * camera.zoom + altura / 2,
    };
  }

  function telaParaMundo(x, y) {
    return {
      x: (x - largura / 2) / camera.zoom + camera.x,
      y: (y - altura / 2) / camera.zoom + camera.y,
    };
  }

  function desenharGalhos(tempo) {
    const nos = estado.nos || [];
    const grupos = estado.grupos || [];
    ctx.lineCap = "round";

    const conexoes = [];
    for (const no of nos) {
      if (!no.grupoPai) continue;
      conexoes.push({ de: no.grupoPai, para: no.id });
    }

    for (const { de, para } of conexoes) {
      if (destinoForaDeCena(de, para)) continue;
      const paiEhGrupo = grupos.some((g) => g.id === de);
      const origem = posMundo(de, tempo, 3);
      const destino = posMundo(para, tempo, ampDeriva(estadoDeId(para)));
      if (!origem || !destino) continue;

      const a = mundoParaTela(origem.x, origem.y);
      const b = mundoParaTela(destino.x, destino.y);
      const hue = hueFromId(para);
      const tocaHover = pairado != null && (de === pairado || para === pairado);
      const dim = esmaecido(de) && esmaecido(para);

      ctx.save();
      if (dim) ctx.globalAlpha = 0.18;
      ctx.strokeStyle = tocaHover
        ? `hsla(${hue}, 85%, 70%, 0.95)`
        : `hsla(${hue}, 65%, ${paiEhGrupo ? 62 : 58}%, ${paiEhGrupo ? 0.5 : 0.75})`;
      ctx.lineWidth = (paiEhGrupo ? 5 : 3) * camera.zoom * (tocaHover ? 1.25 : 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.bezierCurveTo(
        a.x + (b.x - a.x) * 0.35,
        a.y,
        b.x - (b.x - a.x) * 0.35,
        b.y,
        b.x,
        b.y,
      );
      ctx.stroke();
      ctx.restore();
    }
  }

  function destinoForaDeCena(de, para) {
    const destino = posicoes.get(para);
    if (!destino) return true;
    if (destino.camada !== "no") return true;
    // Galho recolhido esconde a subárvore — a aresta também sai de cena.
    if (ocultos.has(de) || ocultos.has(para)) return true;
    return false;
  }

  function estadoDeId(id) {
    const no = (estado.nos || []).find((n) => n.id === id);
    const vivoAtual = vivo[id];
    return vivoAtual?.estado || no?.estado || ESTADO.VAZIO;
  }

  function desenharDependencias(tempo) {
    const deps = estado.dependencias || [];
    const nivel = nivelEfeitos();
    // Fluxo animado: o padrão corre ao longo da curva (marching ants).
    // Desligado congela; sutil corre devagar e sem seta.
    const periodo = 14; // [6, 8]
    const velocidade = nivel === "cheio" ? 0.02 : 0.008;
    ctx.save();
    ctx.setLineDash([6, 8]);
    if (nivel !== "desligado" && !reduzir) ctx.lineDashOffset = -((tempo * velocidade) % periodo);
    else ctx.lineDashOffset = 0;
    ctx.lineWidth = 1.5 * camera.zoom;
    for (const dep of deps) {
      const a = posicoes.get(dep.origem);
      const b = posicoes.get(dep.destino);
      if (!a || !b) continue;
      if (ocultos.has(dep.origem) || ocultos.has(dep.destino)) continue;
      const tocaHover = pairado != null && (dep.origem === pairado || dep.destino === pairado);
      const dim = pairado != null && !tocaHover;
      ctx.strokeStyle = tocaHover
        ? "rgba(255, 255, 255, 0.9)"
        : "rgba(255, 255, 255, 0.55)";
      if (dim) ctx.globalAlpha = 0.2;
      else ctx.globalAlpha = 1;
      const pa = mundoParaTela(a.x, a.y);
      const pb = mundoParaTela(b.x, b.y);
      const meioX = (pa.x + pb.x) / 2;
      const meioY = Math.min(pa.y, pb.y) - 60 * camera.zoom;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.quadraticCurveTo(meioX, meioY, pb.x, pb.y);
      ctx.stroke();
      // Seta de direção na ponta (só no cheio): a tangente da quadrática
      // no fim é pb − meio.
      if (nivel === "cheio" && !reduzir) {
        const tx = pb.x - meioX;
        const ty = pb.y - meioY;
        const tam = Math.hypot(tx, ty) || 1;
        const ux = tx / tam;
        const uy = ty / tam;
        const s = 7 * camera.zoom;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pb.x, pb.y);
        ctx.lineTo(pb.x - ux * s - uy * s * 0.45, pb.y - uy * s + ux * s * 0.45);
        ctx.lineTo(pb.x - ux * s + uy * s * 0.45, pb.y - uy * s - ux * s * 0.45);
        ctx.closePath();
        ctx.fillStyle = tocaHover ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)";
        ctx.fill();
        ctx.setLineDash([6, 8]);
      }
    }
    ctx.restore();
  }

  function estadoVisual(no) {
    const vivoAtual = vivo[no.id];
    const estado = vivoAtual?.estado || no.estado || ESTADO.VAZIO;
    return { estado, detalhe: vivoAtual?.detalhe || "" };
  }

  function desenharGrupo(grupo, tempo) {
    const p = posicoes.get(grupo.id);
    if (!p) return;
    const filhos = (estado.nos || []).filter((n) => n.grupoPai === grupo.id);
    const cor = COR_PAPEL[grupo.papel] || COR_PAPEL.livre;
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
    const gradiente = ctx.createRadialGradient(centro.x, centro.y, raio * 0.2, centro.x, centro.y, raio);
    gradiente.addColorStop(0, `${cor}22`);
    gradiente.addColorStop(0.75, `${cor}12`);
    gradiente.addColorStop(1, `${cor}00`);
    ctx.fillStyle = gradiente;
    ctx.beginPath();
    ctx.ellipse(centro.x, centro.y, raio, raio * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `${cor}55`;
    ctx.lineWidth = 1.2 * camera.zoom;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(233, 238, 245, 0.85)";
    ctx.font = `${Math.round(13 * camera.zoom)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(grupo.titulo, centro.x, centro.y - raio * 0.82 - 10 * camera.zoom);
  }

  function desenharNo(no, tempo) {
    const p = posicoes.get(no.id);
    if (!p || p.camada !== "no") return;
    // Recolhido: a subárvore existe no estado, mas não é desenhada.
    if (ocultos.has(no.id)) return;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
    const { estado: estadoNo } = estadoVisual(no);
    const centro = posMundo(no.id, tempo, ampDeriva(estadoNo));
    if (!centro) return;
    const t = mundoParaTela(centro.x, centro.y);
    const hue = hueFromId(no.id);
    // Hover fora da vizinhança esmaece (padrão Obsidian); o par não some.
    const dim = esmaecido(no.id);
    if (dim) {
      ctx.save();
      ctx.globalAlpha = 0.22;
    }
    // Nascer com escala: criação de chat tem retorno visual imediato (D02).
    const idade = tempo - (Number.isFinite(p.nascidoEm) ? p.nascidoEm : tempo);
    const fracaoEntrada = idade < 0 ? 1 : Math.min(1, idade / 320);
    const escalaEntrada = 1 - (1 - fracaoEntrada) * (1 - fracaoEntrada) * (1 - fracaoEntrada);
    const raioBase = 26 * camera.zoom * (no.grupoPai && (estado.nos || []).some((n) => n.grupoPai === no.id) ? 1.15 : 1);
    const raio = raioOrganico(tempo, p.fase, raioBase) * escalaEntrada;

    let saturacao = 70;
    let luz = 60;
    let alfa = 1;
    let brilho = 0;

    if (estadoNo === ESTADO.ATIVO) {
      saturacao = 82;
      luz = 62;
      brilho = 0.35 + 0.25 * Math.sin(tempo * 0.004 + p.fase);
    } else if (estadoNo === ESTADO.DORMENTE) {
      saturacao = 32;
      luz = 52;
      alfa = 0.72;
    } else if (estadoNo === ESTADO.VAZIO) {
      saturacao = 12;
      luz = 46;
      alfa = 0.55;
    } else if (estadoNo === ESTADO.NAO_ENCONTRADO) {
      saturacao = 6;
      luz = 40;
      alfa = 0.5;
    } else if (estadoNo === ESTADO.INCERTO) {
      saturacao = 18;
      luz = 58;
      alfa = 0.75 + 0.2 * Math.sin(tempo * 0.012 + p.fase);
    }

    // Aura
    if (brilho > 0) {
      ctx.save();
      ctx.shadowColor = `hsla(${hue}, 90%, 65%, ${brilho})`;
      ctx.shadowBlur = 30 * camera.zoom;
      ctx.fillStyle = `hsla(${hue}, ${saturacao}%, ${luz}%, ${alfa})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, raio, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Corpo
    const gradiente = ctx.createRadialGradient(
      t.x - raio * 0.35,
      t.y - raio * 0.4,
      raio * 0.15,
      t.x,
      t.y,
      raio,
    );
    gradiente.addColorStop(0, `hsla(${hue}, ${saturacao}%, ${Math.min(luz + 16, 88)}%, ${alfa})`);
    gradiente.addColorStop(1, `hsla(${hue + 12}, ${saturacao}%, ${Math.max(luz - 18, 22)}%, ${alfa})`);
    ctx.fillStyle = gradiente;
    ctx.beginPath();
    ctx.arc(t.x, t.y, raio, 0, Math.PI * 2);
    ctx.fill();

    // Contorno por estado
    ctx.lineWidth = 2 * camera.zoom;
    if (estadoNo === ESTADO.VAZIO) ctx.setLineDash([4, 5]);
    else if (estadoNo === ESTADO.INCERTO) ctx.setLineDash([2, 4]);
    else ctx.setLineDash([]);
    ctx.strokeStyle =
      estadoNo === ESTADO.NAO_ENCONTRADO
        ? "rgba(255, 120, 120, 0.85)"
        : `hsla(${hue}, 80%, ${luz + 12}%, ${alfa})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, raio + 1.5 * camera.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Seleção
    if (selecionado === no.id) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.6 * camera.zoom;
      ctx.beginPath();
      ctx.arc(t.x, t.y, raio + 7 * camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Hover: anel pulsante que marca o par sob o cursor.
    if (pairado === no.id && !reduzir) {
      const pulso = 10 + 2.5 * Math.sin(tempo * 0.006 + p.fase);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 1.4 * camera.zoom;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(t.x, t.y, raio + pulso * camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Recolhido: marcador
    const filhos = (estado.nos || []).filter((n) => n.grupoPai === no.id);
    if (filhos.length) {
      ctx.fillStyle = "rgba(20, 24, 31, 0.9)";
      ctx.beginPath();
      ctx.arc(t.x + raio * 0.78, t.y - raio * 0.78, 8 * camera.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(233, 238, 245, 0.95)";
      ctx.font = `${Math.round(11 * camera.zoom)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        no.recolhido ? String(filhos.length) : "–",
        t.x + raio * 0.78,
        t.y - raio * 0.78 + 0.5,
      );
    }

    // Rótulos
    if (camera.zoom > 0.45) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(235, 240, 247, 0.95)";
      ctx.font = `${Math.round(12.5 * camera.zoom)}px "Segoe UI", system-ui, sans-serif`;
      const titulo = no.titulo.length > 34 ? `${no.titulo.slice(0, 33)}…` : no.titulo;
      ctx.fillText(titulo, t.x, t.y + raio + 7 * camera.zoom);

      const sub = [];
      if (no.diretorio) sub.push(no.diretorio);
      if (no.worktree) sub.push("worktree");
      if (sub.length && camera.zoom > 0.7) {
        ctx.fillStyle = "rgba(160, 172, 190, 0.9)";
        ctx.font = `${Math.round(10.5 * camera.zoom)}px "Segoe UI", system-ui, sans-serif`;
        ctx.fillText(sub.join(" · "), t.x, t.y + raio + 22 * camera.zoom);
      }
    }
    if (dim) ctx.restore();
  }

  function desenharPoeira(tempo) {
    if (!poeira.length) return;
    ctx.save();
    for (const g of poeira) {
      const cintilar = 0.55 + 0.45 * Math.sin(tempo * 0.0011 + g.f);
      ctx.globalAlpha = g.a * cintilar;
      ctx.fillStyle = "rgba(178, 198, 228, 1)";
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
    fundo.addColorStop(0, "#0d1117");
    fundo.addColorStop(1, "#111823");
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, largura, altura);

    // Movimento reduzido congela o tempo dos efeitos (estático, mas legível).
    const T = reduzir ? 0 : tempo;

    desenharPoeira(T);

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

    camera.x = lerp(camera.x, camera.alvoX, 0.12);
    camera.y = lerp(camera.y, camera.alvoY, 0.12);
    camera.zoom = lerp(camera.zoom, camera.alvoZoom, 0.12);

    passoFisica(dt);
    passoPoeira(dt);
    desenhar(tempo);
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
      const raio = 34;
      if (Math.hypot(p.x - mundo.x, p.y - mundo.y) <= raio) return no;
    }
    return null;
  }

  canvas.addEventListener("pointerdown", (evento) => {
    arrastando.ativo = true;
    arrastando.moveu = false;
    arrastando.x = evento.clientX;
    arrastando.y = evento.clientY;
    canvas.setPointerCapture(evento.pointerId);
  });

  canvas.addEventListener("pointermove", (evento) => {
    if (!arrastando.ativo) {
      // Sem arrastar, o movimento vira hover: realça a vizinhança.
      const retangulo = canvas.getBoundingClientRect();
      const no = noEm(evento.clientX - retangulo.left, evento.clientY - retangulo.top);
      pairar(no ? no.id : null);
      return;
    }
    const dx = evento.clientX - arrastando.x;
    const dy = evento.clientY - arrastando.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) arrastando.moveu = true;
    arrastando.x = evento.clientX;
    arrastando.y = evento.clientY;
    camera.alvoX -= dx / camera.zoom;
    camera.alvoY -= dy / camera.zoom;
  });

  canvas.addEventListener("pointerup", (evento) => {
    arrastando.ativo = false;
    if (canvas.hasPointerCapture(evento.pointerId)) canvas.releasePointerCapture(evento.pointerId);
    if (arrastando.moveu) return;
    const retangulo = canvas.getBoundingClientRect();
    const no = noEm(evento.clientX - retangulo.left, evento.clientY - retangulo.top);
    selecionado = no ? no.id : null;
    onSelecionar(no);
  });

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
    semearPoeira();
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
    camera.alvoX = 0;
    camera.alvoY = 0;
    camera.alvoZoom = 0.75;
  }

  function aplicarZoom(fator) {
    camera.alvoZoom = Math.min(2.4, Math.max(0.25, camera.alvoZoom * fator));
  }

  function ajustar() {
    redimensionar();
    semearPoeira();
  }

  redimensionar();
  semearPoeira();
  window.addEventListener("resize", ajustar);
  requestAnimationFrame(laco);

  return {
    definirEstado,
    definirVivo,
    focar,
    centrar,
    aplicarZoom,
    pairar,
    nivelEfeitos,
    efeitosInfo: () => ({ nivel: nivelEfeitos(), poeira: poeira.length, pairado }),
    selecionar: (id) => {
      selecionado = id;
    },
    camera: () => ({ ...camera }),
  };
}
