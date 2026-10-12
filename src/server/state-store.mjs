/**
 * state-store.mjs — persistência local do TreeOffice.
 *
 * Decisões aplicadas:
 *   D20  arquivo JSON único em `.local/`, com `schemaVersion`
 *   D21  identidade própria do painel; sessão inexistente vira estado, não soma
 *   D22  escrita atômica, backup da versão anterior, modo degradado e lock
 *   D23  nada de conteúdo privado é acrescentado aqui pelo armazenamento
 *
 * Nada é apagado em silêncio: arquivo corrompido recai no backup e gera aviso.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { normalizeState, emptyState } from "../shared/model.mjs";

export const NOME_ESTADO = "state.json";
export const NOME_BACKUP = "state.backup.json";
export const NOME_BACKUP_ANTERIOR = "state.backup-prev.json";
export const NOME_LOCK = "state.lock";
export const NOME_BRIDGE = "bridge.json";

const LOCK_TTL_MS = 15_000;

export function localDir(baseDir) {
  return path.join(baseDir, ".local");
}

export function ensureLocalDir(baseDir) {
  const dir = localDir(baseDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function caminhoEstado(baseDir) {
  return path.join(localDir(baseDir), NOME_ESTADO);
}

function lerJsonSeguro(caminho) {
  try {
    const bruto = fs.readFileSync(caminho, "utf8");
    return { ok: true, valor: JSON.parse(bruto) };
  } catch (erro) {
    return { ok: false, erro };
  }
}

/**
 * Carrega o estado. Ordem: estado atual → backup → estado vazio.
 * `semear` é usado no primeiro uso, para o protótipo já nascer com uma árvore.
 */
export function loadState(baseDir, { semear } = {}) {
  const avisos = [];
  const alvo = caminhoEstado(baseDir);
  const backup = path.join(localDir(baseDir), NOME_BACKUP);

  let leitura = lerJsonSeguro(alvo);
  if (!leitura.ok) {
    if (leitura.erro && leitura.erro.code === "ENOENT") {
      if (typeof semear === "function") {
        const semeado = normalizeState(semear());
        return { ...semeado, avisos, primeiraVez: true };
      }
      return { ...{ ...emptyState(), avisos: [] }, primeiraVez: true };
    }
    avisos.push(`Arquivo de estado ilegível (${leitura.erro?.code ?? "erro"}); tentando backup.`);
    const reserva = lerJsonSeguro(backup);
    if (reserva.ok) {
      const normalizado = normalizeState(reserva.valor);
      avisos.push("Estado restaurado a partir do backup mais recente.");
      return { ...normalizado, avisos, degradado: true };
    }
    avisos.push("Backup também indisponível; árvore vazia carregada. Nada foi sobrescrito.");
    return { ...normalizeState(null), avisos, degradado: true };
  }

  const normalizado = normalizeState(leitura.valor);
  avisos.push(...normalizado.avisos);
  return { ...normalizado, avisos };
}

/** Processo dono do lock ainda vive nesta máquina? Evita roubar lock ativo. */
function pidVivo(pid, maquina) {
  if (maquina !== os.hostname()) return false;
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Adquire o lock de escrita. Devolve função de liberação. */
export function acquireLock(baseDir) {
  const dir = ensureLocalDir(baseDir);
  const alvo = path.join(dir, NOME_LOCK);

  const tentar = () => {
    try {
      const fd = fs.openSync(alvo, "wx");
      const conteudo = JSON.stringify({
        pid: process.pid,
        maquina: os.hostname(),
        criadoEm: new Date().toISOString(),
      });
      fs.writeSync(fd, conteudo);
      fs.closeSync(fd);
      return true;
    } catch (erro) {
      if (erro.code !== "EEXIST") throw erro;
      return false;
    }
  };

  if (tentar()) {
    return {
      ok: true,
      release() {
        try {
          fs.rmSync(alvo, { force: true });
        } catch {
          /* lock obsoleto não impede operação */
        }
      },
    };
  }

  // Lock existe: decidir se está velho.
  const leitura = lerJsonSeguro(alvo);
  if (leitura.ok && leitura.valor?.criadoEm) {
    const idade = Date.now() - new Date(leitura.valor.criadoEm).getTime();
    if (Number.isFinite(idade) && idade < LOCK_TTL_MS) {
      return { ok: false, motivo: `Outra gravação em andamento (${Math.round(idade / 1000)}s atrás).` };
    }
    // Lock velho pelo relógio, mas dono vivo nesta máquina: não roubar.
    if (pidVivo(leitura.valor?.pid, leitura.valor?.maquina)) {
      return {
        ok: false,
        motivo: `Outra gravação em andamento (processo ${leitura.valor.pid} ativo).`,
      };
    }
    // Lock velho: outro processo caiu. Substituir e avisar pelo aviso do chamador.
    try {
      fs.rmSync(alvo, { force: true });
    } catch {
      /* ignorado */
    }
    if (tentar()) {
      return {
        ok: true,
        lockVelho: true,
        release() {
          try {
            fs.rmSync(alvo, { force: true });
          } catch {
            /* ignorado */
          }
        },
      };
    }
  }
  return { ok: false, motivo: "Não foi possível adquirir o lock de escrita." };
}

/**
 * Grava de forma atômica: backup do anterior, escrita em temporário e renomeação.
 * O lock é obrigatório — escrever sem lock seria correr risco de duas
 * instâncias sobrescreverem a árvore (D22).
 */
export function saveState(baseDir, state) {
  const dir = ensureLocalDir(baseDir);
  const alvo = path.join(dir, NOME_ESTADO);
  const backup = path.join(dir, NOME_BACKUP);
  const backupAnterior = path.join(dir, NOME_BACKUP_ANTERIOR);
  const temporario = path.join(dir, `${NOME_ESTADO}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`);

  const lock = acquireLock(baseDir);
  if (!lock.ok) {
    const erro = new Error(lock.motivo || "Escrita bloqueada por lock.");
    erro.code = "LOCKED";
    throw erro;
  }

  try {
    const util = {
      ok: fs.existsSync(alvo),
      existeBackup: fs.existsSync(backup),
    };

    if (util.existeBackup) {
      try {
        fs.copyFileSync(backup, backupAnterior);
      } catch {
        /* backup anterior é cortesia, não bloqueia a gravação */
      }
    }
    if (util.ok) {
      fs.copyFileSync(alvo, backup);
    }

    const utilFinal = fs.existsSync(backup);
    const anteriorExiste = utilFinal || util.existeBackup;

    fs.writeFileSync(temporario, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    fs.renameSync(temporario, alvo);

    return {
      caminho: alvo,
      backup: anteriorExiste ? backup : null,
      lockVelho: lock.lockVelho === true,
    };
  } finally {
    lock.release();
  }
}

export function caminhos(baseDir) {
  return {
    estado: caminhoEstado(baseDir),
    backup: path.join(localDir(baseDir), NOME_BACKUP),
    lock: path.join(localDir(baseDir), NOME_LOCK),
    bridge: path.join(localDir(baseDir), NOME_BRIDGE),
  };
}
