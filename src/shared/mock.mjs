/**
 * mock.mjs — dados simulados da Etapa 2.
 *
 * Nada aqui toca em projetos, chats ou vault reais. Os caminhos são
 * deliberadamente fictícios (/simulado/...) para não confundir com o ambiente
 * do usuário. A simulação vive apenas em memória e nunca é gravada em disco.
 */

import { ESTADO, PAPEL, genId, emptyState } from "./model.mjs";

/** Árvore de demonstração. Hierarquia ilustrativa — não impõe nada (D07). */
export function seedDemoState() {
  const state = emptyState();

  const gCoord = { id: "g_coordenacao", titulo: "Coordenação", papel: PAPEL.LIDERANCA };
  const gExec = { id: "g_execucao", titulo: "Execução", papel: PAPEL.EXECUCAO };
  const gEstudo = { id: "g_estudo", titulo: "Estudo", papel: PAPEL.ESTUDO };
  state.grupos.push(gCoord, gExec, gEstudo);

  const noPlano = {
    id: "n_plano",
    titulo: "Revisar plano do painel",
    papel: PAPEL.EXECUCAO,
    grupoPai: gCoord.id,
    sessionID: null,
    diretorio: null,
    worktree: null,
    instrucoes: "",
    simulado: true,
    estado: ESTADO.ATIVO,
    posicao: { x: -260, y: -120 },
  };
  const noTarefa = {
    id: "n_tarefa",
    titulo: "Preparar próxima tarefa",
    papel: PAPEL.EXECUCAO,
    grupoPai: gCoord.id,
    sessionID: null,
    diretorio: null,
    worktree: null,
    instrucoes: "",
    simulado: true,
    estado: ESTADO.DORMENTE,
    posicao: { x: -260, y: 60 },
  };
  const noPonte = {
    id: "n_ponte",
    titulo: "Implementar ponte local",
    papel: PAPEL.EXECUCAO,
    grupoPai: gExec.id,
    sessionID: "sim_sess_ponte",
    diretorio: "/simulado/projeto-um",
    worktree: "/simulado/projeto-um/wt/ponte",
    instrucoes: "Servir a interface e o estado local sem depender de rede.",
    simulado: true,
    estado: ESTADO.ATIVO,
    posicao: { x: 40, y: -140 },
  };
  const noAtomico = {
    id: "n_atomico",
    titulo: "Testar escrita atômica",
    papel: PAPEL.EXECUCAO,
    grupoPai: noPonte.id,
    sessionID: "sim_sess_atomico",
    diretorio: "/simulado/projeto-um",
    worktree: "/simulado/projeto-um/wt/ponte",
    instrucoes: "",
    simulado: true,
    estado: ESTADO.ATIVO,
    posicao: { x: 300, y: -80 },
  };
  const noContrato = {
    id: "n_contrato",
    titulo: "Investigar contrato da API",
    papel: PAPEL.INVESTIGACAO,
    grupoPai: gExec.id,
    sessionID: "sim_sess_contrato",
    diretorio: "/simulado/projeto-dois",
    worktree: null,
    instrucoes: "",
    simulado: true,
    estado: ESTADO.INCERTO,
    posicao: { x: 40, y: 60 },
  };
  const noSessaoSumida = {
    id: "n_sumida",
    titulo: "Sessão removida lá fora",
    papel: PAPEL.EXECUCAO,
    grupoPai: gExec.id,
    sessionID: "sim_sess_removida",
    diretorio: "/simulado/projeto-um",
    worktree: null,
    instrucoes: "",
    simulado: false,
    estado: ESTADO.NAO_ENCONTRADO,
    posicao: { x: 40, y: 240 },
  };
  const noVazio = {
    id: "n_vazio",
    titulo: "Nó sem sessão",
    papel: PAPEL.LIVRE,
    grupoPai: gExec.id,
    sessionID: null,
    diretorio: null,
    worktree: null,
    instrucoes: "",
    simulado: false,
    estado: ESTADO.VAZIO,
    posicao: { x: 40, y: 400 },
  };
  const noEstudo = {
    id: "n_estudo",
    titulo: "Estudar linguagem visual",
    papel: PAPEL.ESTUDO,
    grupoPai: gEstudo.id,
    sessionID: null,
    diretorio: null,
    worktree: null,
    instrucoes: "",
    simulado: true,
    estado: ESTADO.DORMENTE,
    posicao: { x: 560, y: 180 },
  };

  state.nos.push(noPlano, noTarefa, noPonte, noAtomico, noContrato, noSessaoSumida, noVazio, noEstudo);

  // Aresta de dependência: criada por ação explícita, nunca detectada (D38).
  state.dependencias.push({ origem: noPonte.id, destino: noContrato.id });

  // Ocupação de worktree: sustenta o aviso de compartilhamento (D27).
  state.ocupacaoWorktree.push(
    { worktree: noPonte.worktree, noID: noPonte.id, confirmadoEm: "2026-10-12T00:00:00.000Z" },
    { worktree: noAtomico.worktree, noID: noAtomico.id, confirmadoEm: "2026-10-12T00:00:00.000Z" },
  );

  state.cadastros.push(
    { caminho: "/simulado/projeto-um", projetoID: "sim_proj_um", rotulo: "projeto-um (simulado)" },
    { caminho: "/simulado/projeto-dois", projetoID: "sim_proj_dois", rotulo: "projeto-dois (simulado)" },
  );

  state.preferencias = { camera: { x: 0, y: 0, zoom: 0.75 } };

  return state;
}

/* ── Motor de simulação ────────────────────────────────────────────────────
 * Determina o estado vivo dos nós marcados com `simulado: true`. O objetivo é
 * exercitar a linguagem visual da D16 sem depender do OpenCode.
 */

const CICLOS = [
  { peso: 0.45, estado: ESTADO.ATIVO, detalhe: "trabalhando" },
  { peso: 0.2, estado: ESTADO.ATIVO, detalhe: "pensando" },
  { peso: 0.15, estado: ESTADO.ATIVO, detalhe: "editando arquivos" },
  { peso: 0.12, estado: ESTADO.DORMENTE, detalhe: "aguardando" },
  { peso: 0.05, estado: ESTADO.INCERTO, detalhe: "estado incerto" },
];

function sortearTicket() {
  const total = CICLOS.reduce((soma, item) => soma + item.peso, 0);
  let alvo = Math.random() * total;
  for (const item of CICLOS) {
    alvo -= item.peso;
    if (alvo <= 0) return item;
  }
  return CICLOS[0];
}

export function criarSimulacao(state) {
  const sim = new Map();
  for (const no of state.nos) {
    if (!no.simulado) continue;
    sim.set(no.id, { estado: no.estado, detalhe: "iniciando", desde: Date.now(), trocaEm: Date.now() + 1500 });
  }
  return sim;
}

/** Avança a simulação. Devolve true se algo mudou. */
export function tickSimulacao(sim, state, agora = Date.now()) {
  let mudou = false;
  for (const no of state.nos) {
    if (!no.simulado) continue;
    let atual = sim.get(no.id);
    if (!atual) {
      atual = { estado: no.estado, detalhe: "", desde: agora, trocaEm: agora };
      sim.set(no.id, atual);
    }
    if (agora < atual.trocaEm) continue;
    const ticket = sortearTicket();
    atual.estado = ticket.estado;
    atual.detalhe = ticket.detalhe;
    atual.desde = agora;
    // Estados ativos mudam com mais frequência; dormente e incerto duram mais.
    const base = ticket.estado === ESTADO.ATIVO ? 3500 : 6000;
    atual.trocaEm = agora + base + Math.random() * 4000;
    mudou = true;
  }
  return mudou;
}

/** Estado efetivo de um nó, sobreposto pela simulação quando existir. */
export function estadoEfetivo(state, sim, noID) {
  const no = state.nos.find((n) => n.id === noID);
  if (!no) return { estado: ESTADO.VAZIO, detalhe: "" };
  const vivo = sim.get(noID);
  if (vivo) return { estado: vivo.estado, detalhe: vivo.detalhe, desde: vivo.desde };
  return { estado: no.estado, detalhe: no.estado === ESTADO.NAO_ENCONTRADO ? "sessão não encontrada" : "" };
}

export function novoNoSimulado({ titulo, papel, grupoPai, diretorio, instrucoes, worktree }) {
  return {
    id: genId("n"),
    titulo: titulo.slice(0, 200),
    papel,
    grupoPai: grupoPai ?? null,
    sessionID: null,
    diretorio: diretorio ?? null,
    worktree: worktree ?? null,
    instrucoes: (instrucoes ?? "").slice(0, 4000),
    simulado: true,
    estado: ESTADO.VAZIO,
    posicao: { x: 0, y: 0 },
    recolhido: false,
  };
}
