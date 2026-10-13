/**
 * opencode-client.mjs — cliente HTTP somente leitura do serviço OpenCode.
 *
 * Fase B (D12, D46): a ponte fala com o serviço local por HTTP com o `fetch`
 * do próprio Node, sem dependência nova. Só GET: nada aqui cria, altera ou
 * remove sessão, projeto ou worktree.
 *
 * Descoberta (sem iniciar serviço automaticamente):
 *   1. `opcoes.url` ou `OPENCODE_SERVER_URL` (explícito vence);
 *   2. arquivo de serviço com `url` + `password` em
 *      `$XDG_STATE_HOME/opencode/service.json` ou
 *      `~/.local/state/opencode/service.json` (Linux) ou
 *      `%LOCALAPPDATA%/opencode/service.json` (Windows);
 *   3. `password` de `~/.config/opencode/service.json` combinado com a URL
 *      explícita, quando o arquivo de estado não existe.
 *
 * A credencial vive só na memória deste módulo (closure). Nunca é gravada em
 * `.local/`, nunca vai ao navegador, nunca entra em log (D23, D41).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TIMEOUT_MS = 8000;

function baseCasa(opcoes = {}) {
  if (opcoes.casa) return opcoes.casa;
  // `os.homedir()` no Windows ignora `$HOME`; respeitar a variável quando
  // definida mantém o comportamento portátil (D43) e permite HOME temporário
  // nos testes nos dois sistemas.
  if (process.env.HOME) return process.env.HOME;
  return os.homedir();
}

function candidatosEstado(casa) {
  const lista = [];
  const xdg = process.env.XDG_STATE_HOME;
  if (xdg) lista.push(path.join(xdg, "opencode", "service.json"));
  lista.push(path.join(casa, ".local", "state", "opencode", "service.json"));
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA;
    if (local) lista.push(path.join(local, "opencode", "service.json"));
  }
  return lista;
}

function candidatosSenha(casa) {
  const lista = [path.join(casa, ".config", "opencode", "service.json")];
  if (process.platform === "win32" && process.env.APPDATA) {
    lista.push(path.join(process.env.APPDATA, "opencode", "service.json"));
  }
  return lista;
}

function lerJson(caminho) {
  try {
    return JSON.parse(fs.readFileSync(caminho, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Descobre URL e credencial do serviço já em execução. Devolve
 * `{ url, password, version, pid, origem }` ou `{ erro }`.
 * `origem` descreve onde a URL foi encontrada, sem incluir segredo.
 */
export function descobrirServico(opcoes = {}) {
  const casa = baseCasa(opcoes);
  const urlExplicita = opcoes.url || process.env.OPENCODE_SERVER_URL || null;

  for (const caminho of candidatosEstado(casa)) {
    const lido = lerJson(caminho);
    if (lido && typeof lido.url === "string" && typeof lido.password === "string") {
      return {
        url: (urlExplicita || lido.url).replace(/\/+$/, ""),
        password: lido.password,
        version: lido.version || null,
        pid: lido.pid || null,
        origem: `estado:${caminho}`,
      };
    }
  }

  if (urlExplicita) {
    for (const caminho of candidatosSenha(casa)) {
      const lido = lerJson(caminho);
      const senha = typeof lido?.password === "string" ? lido.password : null;
      if (senha) {
        return { url: urlExplicita.replace(/\/+$/, ""), password: senha, version: null, pid: null, origem: `senha:${caminho}` };
      }
    }
    return { erro: "URL explícita sem senha: nenhum service.json com password foi encontrado." };
  }

  return { erro: "Serviço OpenCode não encontrado: nenhum service.json com url foi localizado e OPENCODE_SERVER_URL não foi definida." };
}

function cabecalhoAuth(password) {
  const basico = Buffer.from(`opencode:${password}`, "utf8").toString("base64");
  return { authorization: `Basic ${basico}` };
}

async function getJson(url, password, caminho, params = {}) {
  const alvo = new URL(caminho, `${url}/`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") alvo.searchParams.set(k, String(v));
  }
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(alvo, { headers: { ...cabecalhoAuth(password), accept: "application/json" }, signal: controle.signal });
    if (resposta.status === 401) throw new Error("Serviço recusou a credencial (401).");
    if (!resposta.ok) throw new Error(`Serviço respondeu ${resposta.status} em ${caminho}.`);
    return await resposta.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Cria o cliente somente leitura a partir do serviço descoberto. */
export function criarClienteOpenCode(servico) {
  const { url, password } = servico;
  if (!url || !password) throw new Error("Serviço sem url ou credencial.");

  return {
    url,
    version: servico.version || null,

    info() {
      return getJson(url, password, "/api/info");
    },

    listarProjetos() {
      return getJson(url, password, "/api/project");
    },

    listarSessoes(params = {}) {
      return getJson(url, password, "/api/session", { limit: 50, ...params });
    },

    /** Travessia por cursor até esgotar ou atingir `maxPaginas` (só leitura). */
    async listarTodasSessoes({ limit = 50, maxPaginas = 20, ...filtros } = {}) {
      const todas = [];
      let cursor = null;
      for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
        const resposta = await getJson(url, password, "/api/session", { ...filtros, limit, ...(cursor ? { cursor } : {}) });
        const dados = Array.isArray(resposta?.data) ? resposta.data : [];
        todas.push(...dados);
        const proximo = resposta?.cursor?.next;
        if (!proximo) break;
        cursor = proximo;
      }
      return todas;
    },

    listarWorktrees(projectID) {
      if (!projectID) throw new Error("projectID é obrigatório para listar worktrees.");
      return getJson(url, password, "/api/worktree", { projectID });
    },

    /**
     * Assina o SSE (`GET /api/event`). Resolve com `{ fechar, ok }`.
     * `onEvento` recebe `{ tipo, sessaoID, bruto }`. Erros de rede chamam
     * `onErro` sem lançar; a reconexão é por releitura completa (D33),
     * decidida pela ponte, não aqui.
     */
    async assinarEventos({ onEvento, onErro, sinal } = {}) {
      const controle = new AbortController();
      const encerrarExterno = () => controle.abort();
      sinal?.addEventListener?.("abort", encerrarExterno, { once: true });
      try {
        const resposta = await fetch(`${url}/api/event`, {
          headers: { ...cabecalhoAuth(password), accept: "text/event-stream" },
          signal: controle.signal,
        });
        if (!resposta.ok || !resposta.body) {
          throw new Error(`SSE respondeu ${resposta.status}.`);
        }
        const leitor = resposta.body.getReader();
        const decodificador = new TextDecoder();
        let resto = "";
        const fechar = () => {
          try {
            leitor.cancel();
          } catch { /* encerrar é idempotente */ }
          controle.abort();
        };
        (async () => {
          try {
            for (;;) {
              const { done, value } = await leitor.read();
              if (done) break;
              resto += decodificador.decode(value, { stream: true });
              const blocos = resto.split("\n\n");
              resto = blocos.pop();
              for (const bloco of blocos) {
                for (const linha of bloco.split("\n")) {
                  const texto = linha.trim();
                  if (!texto.startsWith("data:")) continue;
                  try {
                    const bruto = JSON.parse(texto.slice(5).trim());
                    const tipo = bruto?.type || "";
                    const sessaoID = bruto?.data?.sessionID || bruto?.data?.session_id || null;
                    onEvento?.({ tipo, sessaoID, bruto });
                  } catch { /* bloco parcial: ignorar sem derrubar o stream */ }
                }
              }
            }
          } catch (erro) {
            if (erro?.name !== "AbortError") onErro?.(erro);
          }
        })();
        return { fechar, ok: true };
      } catch (erro) {
        if (erro?.name !== "AbortError") onErro?.(erro);
        return { fechar: () => controle.abort(), ok: false };
      }
    },
  };
}
