/**
 * tree.js — renderização orgânica da árvore do TreeOffice.
 *
 * Objetivo da Etapa 2: provar que a árvore pode ser orgânica, animada e estável
 * sem depender de biblioteca externa (D19 continua em aberto). Todo o desenho
 * usa Canvas 2D, servido localmente pela ponte (D25).
 *
 * Regras visuais aplicadas:
 *   D15  três camadas: grupos, nós e dependências, com grafia distinta
 *   D16  chat parado continua visível em estado dormente; ausência de dado
 *        nunca é desenhada como estado
 *   posições são memorizadas: atualizações não provocam saltos
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

    grupos.forEach((grupo, indiceGrupo) => {
      const filhoIds = filhosPorPai.get(grupo.id) || [];
      const colunaX = indiceGrupo * espaco.x;
      const baseY = -((filhoIds.length - 1) * espaco.y) / 2;
      const base = posicoes.get(grupo.id) || { x: colunaX, y: baseY };
      posicoes.set(grupo.id, {
        ...base,
        alvoX: colunaX,
        alvoY: baseY,
        camada: "grupo",
      });

      const percorrer = (id, deslocamentoX, y) => {
        const no = nos.find((n) => n.id === id);
        if (!no) return;
        if (no.recolhido) {
          const atual = posicoes.get(id) || { x: deslocamentoX, y };
          posicoes.set(id, { ...atual, alvoX: deslocamentoX, alvoY: y, camada: "no" });
          return;
        }
        const filhos = filhosPorPai.get(id) || [];
        const filhosVisiveis = filhos.filter((f) => !f.recolhido);
        const atual = posicoes.get(id) || { x: deslocamentoX, y };
        posicoes.set(id, {
          ...atual,
          alvoX: deslocamentoX,
          alvoY: y,
          camada: "no",
        });
        filhosVisiveis.forEach((filho, indice) => {
          percorrer(filho.id, deslocamentoX + espaco.x, y + (indice - (filhosVisiveis.length - 1) / 2) * espaco.y);
        });
      };

      filhoIds.forEach((no, indice) => {
        percorrer(no.id, colunaX, baseY + (indice - (filhoIds.length - 1) / 2) * espaco.y);
      });
    });
  }

  function inicializarPosicoes() {
    calcularAncoras();
    for (const [id, p] of posicoes) {
      if (!Number.isFinite(p.x)) p.x = p.alvoX;
      if (!Number.isFinite(p.y)) p.y = p.alvoY;
      if (!Number.isFinite(p.vx)) p.vx = 0;
      if (!Number.isFinite(p.vy)) p.vy = 0;
      p.fase = hashNum(id) * Math.PI * 2;
    }
  }

  function passoFisica(dt) {
    const amortecimento = 0.86;
    const atracao = 0.045;

    for (const [id, p] of posicoes) {
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

  function desenharGalhos() {
    const nos = estado.nos || [];
    const grupos = estado.grupos || [];
    ctx.lineCap = "round";

    const conexoes = [];
    for (const no of nos) {
      if (!no.grupoPai) continue;
      conexoes.push({ de: no.grupoPai, para: no.id });
    }

    for (const { de, para } of conexoes) {
      const origem = posicoes.get(de);
      const destino = posicoes.get(para);
      if (!origem || !destino) continue;
      if (destino.camada !== "no") continue;

      const paiEhGrupo = grupos.some((g) => g.id === de);
      const a = mundoParaTela(origem.x, origem.y);
      const b = mundoParaTela(destino.x, destino.y);
      const hue = hueFromId(para);

      ctx.strokeStyle = `hsla(${hue}, 65%, ${paiEhGrupo ? 62 : 58}%, ${paiEhGrupo ? 0.5 : 0.75})`;
      ctx.lineWidth = (paiEhGrupo ? 5 : 3) * camera.zoom;
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
    }
  }

  function desenharDependencias() {
    const deps = estado.dependencias || [];
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 1.5 * camera.zoom;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    for (const dep of deps) {
      const a = posicoes.get(dep.origem);
      const b = posicoes.get(dep.destino);
      if (!a || !b) continue;
      const pa = mundoParaTela(a.x, a.y);
      const pb = mundoParaTela(b.x, b.y);
      const meioX = (pa.x + pb.x) / 2;
      const meioY = Math.min(pa.y, pb.y) - 60 * camera.zoom;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.quadraticCurveTo(meioX, meioY, pb.x, pb.y);
      ctx.stroke();
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
    const { estado } = estadoVisual(no);
    const t = mundoParaTela(p.x, p.y);
    const hue = hueFromId(no.id);
    const raioBase = 26 * camera.zoom * (no.grupoPai && (estado.nos || []).some((n) => n.grupoPai === no.id) ? 1.15 : 1);
    const raio = raioOrganico(tempo, p.fase, raioBase);

    let saturacao = 70;
    let luz = 60;
    let alfa = 1;
    let brilho = 0;

    if (estado === ESTADO.ATIVO) {
      saturacao = 82;
      luz = 62;
      brilho = 0.35 + 0.25 * Math.sin(tempo * 0.004 + p.fase);
    } else if (estado === ESTADO.DORMENTE) {
      saturacao = 32;
      luz = 52;
      alfa = 0.72;
    } else if (estado === ESTADO.VAZIO) {
      saturacao = 12;
      luz = 46;
      alfa = 0.55;
    } else if (estado === ESTADO.NAO_ENCONTRADO) {
      saturacao = 6;
      luz = 40;
      alfa = 0.5;
    } else if (estado === ESTADO.INCERTO) {
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
    if (estado === ESTADO.VAZIO) ctx.setLineDash([4, 5]);
    else if (estado === ESTADO.INCERTO) ctx.setLineDash([2, 4]);
    else ctx.setLineDash([]);
    ctx.strokeStyle =
      estado === ESTADO.NAO_ENCONTRADO
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

    ctx.save();
    ctx.globalAlpha = 0.5;
    for (const grupo of estado.grupos || []) desenharGrupo(grupo, tempo);
    ctx.restore();

    desenharDependencias();
    desenharGalhos();
    for (const no of estado.nos || []) desenharNo(no, tempo);
  }

  let ultimo = 0;
  function laco(tempo) {
    const dt = ultimo ? Math.min((tempo - ultimo) / 16.666, 3) : 1;
    ultimo = tempo;

    camera.x = lerp(camera.x, camera.alvoX, 0.12);
    camera.y = lerp(camera.y, camera.alvoY, 0.12);
    camera.zoom = lerp(camera.zoom, camera.alvoZoom, 0.12);

    passoFisica(dt);
    desenhar(tempo);
    requestAnimationFrame(laco);
  }

  /* ── Interação ──────────────────────────────────────────────────────────── */

  function noEm(x, y) {
    const mundo = telaParaMundo(x, y);
    // Do topo (último desenhado) para baixo.
    for (let i = (estado.nos || []).length - 1; i >= 0; i -= 1) {
      const no = estado.nos[i];
      const p = posicoes.get(no.id);
      if (!p || p.camada !== "no") continue;
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
    if (!arrastando.ativo) return;
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
    calcularAncoras();
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
  }

  redimensionar();
  window.addEventListener("resize", ajustar);
  requestAnimationFrame(laco);

  return {
    definirEstado,
    definirVivo,
    focar,
    centrar,
    aplicarZoom,
    selecionar: (id) => {
      selecionado = id;
    },
    camera: () => ({ ...camera }),
  };
}
