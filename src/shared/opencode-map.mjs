/**
 * opencode-map.mjs — mapeamento puro do OpenCode para os estados visuais.
 *
 * Fase B, somente leitura. Nenhuma chamada de rede aqui: só funções puras,
 * compartilhadas pela ponte e pelos testes (D16, D32, D33).
 *
 * Entrada: objetos `Session.Info` do contrato comprovado em PESQUISA §8
 * (`id`, `projectID`, `time.{created,updated,idle}`, `outcome`, `location`,
 * `title`). Saída: estados do contrato local (model.mjs).
 */

import { ESTADO } from "./model.mjs";

/** Sessão considerada ativa se vista há menos que isso (sem SSE). */
export const LIMITE_ATIVO_MS = 90_000;

/** Inventário considerado recente abaixo disso; acima, nós reais viram incerto. */
export const LIMITE_RECENTE_MS = 120_000;

const TIPOS_ATIVOS = new Set([
  "session.step.started",
  "session.text.started",
  "session.reasoning.started",
  "session.tool.input.started",
  "session.tool.called",
  "session.tool.progress",
  "session.step.streamed",
  "session.execution.started",
  "shell.created",
  "permission.asked",
]);

const TIPOS_DORMENTES = new Set([
  "session.step.ended",
  "session.tool.success",
  "session.tool.failed",
  "session.reasoning.ended",
  "session.tool.input.ended",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.usage.updated",
  "shell.exited",
  "shell.deleted",
  "server.connected",
]);

/**
 * Estado de uma sessão do inventário, sem considerar eventos ao vivo.
 * `outcome == null` indica sessão ainda em curso no serviço observado.
 */
export function mapearEstadoSessao(sessao, agora = Date.now()) {
  if (!sessao || typeof sessao !== "object" || !sessao.id) return ESTADO.NAO_ENCONTRADO;
  const tempo = sessao.time && typeof sessao.time === "object" ? sessao.time : {};
  const visto = tempo.idle ?? tempo.updated ?? tempo.created ?? 0;
  const recente = Number.isFinite(visto) && agora - visto < LIMITE_ATIVO_MS;
  if (sessao.outcome == null || recente) return ESTADO.ATIVO;
  return ESTADO.DORMENTE;
}

/** Detalhe curto para exibição, sem conteúdo privado (só o tipo). */
export function detalheDoEvento(tipo) {
  if (!tipo) return "";
  if (tipo === "permission.asked") return "aguardando permissão";
  if (tipo.startsWith("session.reasoning.")) return "pensando";
  if (tipo.startsWith("session.tool.")) return "usando ferramenta";
  if (tipo.startsWith("session.step.")) return "trabalhando";
  if (tipo.startsWith("session.execution.")) return "executando";
  if (tipo.startsWith("session.text.")) return "escrevendo";
  if (tipo.startsWith("shell.")) return "terminal";
  if (tipo === "session.idle") return "ociosa";
  if (tipo === "session.error") return "erro";
  return tipo.replace(/^session\./, "");
}

/** Classifica um evento SSE como sinal de atividade ou de repouso. */
export function classificarEvento(tipo) {
  if (TIPOS_ATIVOS.has(tipo)) return ESTADO.ATIVO;
  if (TIPOS_DORMENTES.has(tipo)) return ESTADO.DORMENTE;
  if (tipo === "session.idle") return ESTADO.DORMENTE;
  if (tipo === "session.error") return ESTADO.INCERTO;
  if (tipo === "session.deleted") return ESTADO.NAO_ENCONTRADO;
  return ESTADO.ATIVO;
}

/**
 * Estado efetivo de um nó do painel diante do inventário real.
 * Nunca remove o nó: sessão ausente vira `nao_encontrado` (D21),
 * inventário velho ou com erro vira `incerto` (D32).
 */
export function estadoDoNoReal(no, inventario, vivacidade, agora = Date.now()) {
  if (!no || !no.sessionID) return { estado: ESTADO.VAZIO, detalhe: "" };
  const vivo = vivacidade?.get?.(no.sessionID);
  if (vivo && agora - vivo.desde < LIMITE_ATIVO_MS) {
    return { estado: vivo.estado, detalhe: vivo.detalhe || "", desde: vivo.desde };
  }
  if (inventario?.erro || !inventario?.atualizadoEm || agora - inventario.atualizadoEm > LIMITE_RECENTE_MS) {
    return { estado: ESTADO.INCERTO, detalhe: "aguardando sincronização" };
  }
  const sessao = inventario.sessoes?.get?.(no.sessionID);
  if (!sessao) return { estado: ESTADO.NAO_ENCONTRADO, detalhe: "sessão não encontrada" };
  return { estado: mapearEstadoSessao(sessao, agora), detalhe: "" };
}
