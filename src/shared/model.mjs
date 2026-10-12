/**
 * model.mjs — contrato de estado do TreeOffice.
 *
 * Camadas separadas, conforme D15:
 *   grupos           hierarquia organizacional (metadado visual, D17)
 *   nos              nós de chat; identidade própria do painel (D21)
 *   dependencias     arestas pontilhadas, criadas só por ação explícita (D38)
 *   ocupacaoWorktree quem ocupa qual worktree (D27)
 *   cadastros        pastas e projetos cadastrados pelo usuário (D14)
 *   preferencias     estado visual e de navegação
 *
 * O que nunca entra aqui (D23): conteúdo de conversa, notas do vault,
 * credenciais ou tokens.
 *
 * A simulação da Etapa 2 vive apenas em memória, no servidor, e é entregue
 * pela API no campo `simulacao`. Ela nunca é gravada em disco.
 */

export const SCHEMA_VERSION = 1;

/** Estados visuais de um nó. */
export const ESTADO = {
  ATIVO: "ativo",
  DORMENTE: "dormente",
  VAZIO: "vazio",
  NAO_ENCONTRADO: "nao_encontrado",
  INCERTO: "incerto",
};

export const ESTADOS = Object.freeze(Object.values(ESTADO));

/** Papel organizacional: metadado visual, sem comportamento automático (D17). */
export const PAPEL = {
  LIDERANCA: "lideranca",
  EXECUCAO: "execucao",
  INVESTIGACAO: "investigacao",
  ESTUDO: "estudo",
  LIVRE: "livre",
};

export const PAPEIS = Object.freeze(Object.values(PAPEL));

export const PAPEL_COR = Object.freeze({
  lideranca: "#7cc4ff",
  execucao: "#7ee0b8",
  investigacao: "#ffb86b",
  estudo: "#c9a7ff",
  livre: "#9aa4b2",
});

export function genId(prefixo) {
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${prefixo}_${Date.now().toString(36)}${aleatorio}`;
}

/** Cor derivada do identificador, estável entre execuções (como na referência). */
export function hueFromId(id) {
  let h = 0;
  for (let i = 0; i < String(id).length; i += 1) h = (h * 31 + String(id).charCodeAt(i)) & 0xffff;
  return h % 360;
}

export function folderName(caminho) {
  const partes = String(caminho || "").split(/[/\\]/).filter(Boolean);
  return partes.length ? partes[partes.length - 1] : String(caminho || "");
}

export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    grupos: [],
    nos: [],
    dependencias: [],
    ocupacaoWorktree: [],
    cadastros: [],
    preferencias: {},
  };
}

/* ── Normalização defensiva ─────────────────────────────────────────────────
 * O arquivo de estado pode estar corrompido, ter sido editado à mão ou vir de
 * uma versão anterior do esquema. A ponte nunca descarta a árvore em silêncio:
 * normaliza o que der, registra avisos e devolve um estado degradado (D22).
 */

function texto(valor, padrao = "") {
  return typeof valor === "string" ? valor : padrao;
}

function numOu(valor, padrao) {
  return Number.isFinite(valor) ? valor : padrao;
}

function lista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function normalizaNo(bruto, avisos) {
  if (!bruto || typeof bruto !== "object") return null;
  const id = texto(bruto.id).trim();
  if (!id) {
    avisos.push("Nó sem identificador foi ignorado.");
    return null;
  }
  const estado = ESTADOS.includes(bruto.estado) ? bruto.estado : ESTADO.VAZIO;
  const posicao = bruto.posicao && typeof bruto.posicao === "object" ? bruto.posicao : {};
  return {
    id,
    titulo: texto(bruto.titulo, id).slice(0, 200),
    papel: PAPEIS.includes(bruto.papel) ? bruto.papel : PAPEL.LIVRE,
    grupoPai: bruto.grupoPai == null ? null : texto(bruto.grupoPai),
    sessionID: bruto.sessionID == null ? null : texto(bruto.sessionID),
    diretorio: bruto.diretorio == null ? null : texto(bruto.diretorio),
    worktree: bruto.worktree == null ? null : texto(bruto.worktree),
    instrucoes: texto(bruto.instrucoes).slice(0, 4000),
    simulado: bruto.simulado === true,
    estado,
    incerto: bruto.incerto === true,
    posicao: { x: numOu(posicao.x, 0), y: numOu(posicao.y, 0) },
    recolhido: bruto.recolhido === true,
  };
}

function normalizaGrupo(bruto, avisos) {
  if (!bruto || typeof bruto !== "object") return null;
  const id = texto(bruto.id).trim();
  if (!id) {
    avisos.push("Grupo sem identificador foi ignorado.");
    return null;
  }
  return {
    id,
    titulo: texto(bruto.titulo, id).slice(0, 200),
    papel: PAPEIS.includes(bruto.papel) ? bruto.papel : PAPEL.LIVRE,
    diretorioCadastrado: bruto.diretorioCadastrado == null ? null : texto(bruto.diretorioCadastrado),
    posicao: { x: numOu(bruto.posicao?.x, 0), y: numOu(bruto.posicao?.y, 0) },
    recolhido: bruto.recolhido === true,
  };
}

function normalizaDependencia(bruto, avisos, idsValidos) {
  const origem = texto(bruto?.origem);
  const destino = texto(bruto?.destino);
  if (!idsValidos.has(origem) || !idsValidos.has(destino)) {
    avisos.push(`Dependência ${origem || "?"}→${destino || "?"} aponta para nó inexistente e foi ignorada.`);
    return null;
  }
  return { origem, destino };
}

function normalizaOcupacao(bruto, avisos, idsValidos) {
  if (!bruto || typeof bruto !== "object") return null;
  const worktree = texto(bruto.worktree).trim();
  const noID = texto(bruto.noID);
  if (!worktree || !idsValidos.has(noID)) return null;
  return { worktree, noID, confirmadoEm: texto(bruto.confirmadoEm) };
}

export function normalizeState(bruto) {
  const avisos = [];
  if (bruto == null || typeof bruto !== "object" || Array.isArray(bruto)) {
    return { state: emptyState(), avisos: ["Estado bruto inválido; árvore vazia carregada."] };
  }
  if (bruto.schemaVersion !== SCHEMA_VERSION) {
    avisos.push(
      `Versão do esquema ${JSON.stringify(bruto.schemaVersion)} diferente de ${SCHEMA_VERSION}; ` +
        "o conteúdo foi mantido e pode precisar de revisão.",
    );
  }

  const grupos = lista(bruto.grupos)
    .map((g) => normalizaGrupo(g, avisos))
    .filter(Boolean);

  const nos = lista(bruto.nos)
    .map((n) => normalizaNo(n, avisos))
    .filter(Boolean);

  const ids = new Set([...grupos.map((g) => g.id), ...nos.map((n) => n.id)]);

  const dependencias = lista(bruto.dependencias)
    .map((d) => normalizaDependencia(d, avisos, ids))
    .filter(Boolean);

  const ocupacaoWorktree = lista(bruto.ocupacaoWorktree)
    .map((o) => normalizaOcupacao(o, avisos, ids))
    .filter(Boolean);

  const cadastros = lista(bruto.cadastros)
    .filter((c) => c && typeof c === "object" && texto(c.caminho).trim())
    .map((c) => ({
      caminho: texto(c.caminho),
      projetoID: c.projetoID == null ? null : texto(c.projetoID),
      rotulo: texto(c.rotulo, folderName(c.caminho)),
    }));

  const preferencias =
    bruto.preferencias && typeof bruto.preferencias === "object" ? { ...bruto.preferencias } : {};

  const state = {
    schemaVersion: SCHEMA_VERSION,
    grupos,
    nos,
    dependencias,
    ocupacaoWorktree,
    cadastros,
    preferencias,
  };

  // Sessões que deixaram de existir ficam marcadas, nunca somem (D21).
  for (const no of state.nos) {
    if (no.sessionID && no.incerto) no.estado = ESTADO.INCERTO;
    else if (no.sessionID && no.estado === ESTADO.NAO_ENCONTRADO) no.estado = ESTADO.NAO_ENCONTRADO;
  }

  return { state, avisos };
}

/** Quem ocupa um worktree, ignorando o próprio nó (D27). */
export function ocupanteDoWorktree(state, worktree, ignorarNoID) {
  if (!worktree) return null;
  return (
    state.ocupacaoWorktree.find((o) => o.worktree === worktree && o.noID !== ignorarNoID) || null
  );
}

/** Remove registros de ocupação de nós que não existem mais. */
export function limparOcupacaoOrfa(state) {
  const ids = new Set(state.nos.map((n) => n.id));
  state.ocupacaoWorktree = state.ocupacaoWorktree.filter((o) => ids.has(o.noID));
}

/** Remove arestas que apontam para nós removidos. */
export function limparDependenciasOrfas(state) {
  const ids = new Set(state.nos.map((n) => n.id));
  state.dependencias = state.dependencias.filter((d) => ids.has(d.origem) && ids.has(d.destino));
}

/** Distância até a raiz, usada para agrupar visualmente. */
export function profundidade(state, noID, vistos = new Set()) {
  const no = state.nos.find((n) => n.id === noID);
  if (!no || !no.grupoPai) return 0;
  if (vistos.has(noID)) return 0;
  vistos.add(noID);
  const paiEhGrupo = state.grupos.some((g) => g.id === no.grupoPai);
  if (paiEhGrupo) return 1;
  return 1 + profundidade(state, no.grupoPai, vistos);
}
