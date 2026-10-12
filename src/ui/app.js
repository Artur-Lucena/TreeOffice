/**
 * app.js — interface do protótipo (Etapa 2).
 *
 * Tudo aqui é simulado: nenhuma chamada ao OpenCode, nenhum acesso a projetos
 * ou ao vault. O que o protótipo precisa provar é aparência, animação,
 * navegação, popup e persistência (D02, D03, D16, D19, D22).
 */

import { criarArvore } from "./tree.js";

const PAPEL_ROTULO = {
  lideranca: "liderança",
  execucao: "execução",
  investigacao: "investigação",
  estudo: "estudo",
  livre: "livre",
};

const ESTADO_ROTULO = {
  ativo: "ativo",
  dormente: "dormente",
  vazio: "sem sessão",
  nao_encontrado: "não encontrado",
  incerto: "incerto",
};

const parametros = new URLSearchParams(location.search);
const tokenDaUrl = parametros.get("token");
let TOKEN = tokenDaUrl || sessionStorage.getItem("treeoffice.token") || "";
if (tokenDaUrl) {
  sessionStorage.setItem("treeoffice.token", tokenDaUrl);
  // O token já está guardado; tirá-lo da barra reduz exposição em histórico.
  if (history.replaceState) {
    const limpa = new URL(location.href);
    limpa.searchParams.delete("token");
    history.replaceState(null, "", limpa.pathname + limpa.search + limpa.hash);
  }
}

const el = (id) => document.getElementById(id);

let state = null;
let vivo = {};
let arvore = null;
let selecionado = null;

/* ── Comunicação com a ponte ────────────────────────────────────────────── */

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    method: opcoes.method || "GET",
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(opcoes.corpo ? { "content-type": "application/json" } : {}),
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });

  if (resposta.status === 401) {
    marcarStatus("token recusado — reabra o link impresso pela ponte", "erro");
    throw new Error("token inválido");
  }

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || `erro ${resposta.status}`);
  return corpo;
}

function marcarStatus(texto, tipo = "") {
  const alvo = el("status");
  alvo.textContent = texto;
  alvo.className = `status ${tipo}`.trim();
}

function aviso(texto, tipo = "") {
  const caixa = el("avisos");
  const no = document.createElement("div");
  no.className = `aviso ${tipo}`.trim();
  no.textContent = texto;
  caixa.appendChild(no);
  setTimeout(() => {
    no.style.opacity = "0";
    no.style.transition = "opacity .4s ease";
    setTimeout(() => no.remove(), 420);
  }, 5200);
}

async function salvar(mensagem) {
  try {
    const resposta = await api("/api/estado", { method: "POST", corpo: { state } });
    state = resposta.state || state;
    arvore?.definirEstado(state, mapaVivo(resposta.simulacao));
    for (const texto of resposta.avisos || []) aviso(texto, "alerta");
    if (mensagem) aviso(mensagem, "ok");
    return true;
  } catch (erro) {
    aviso(`Não foi possível salvar: ${erro.message}`, "erro");
    return false;
  }
}

/* ── Carregamento e ciclo de vida ───────────────────────────────────────── */

function mapaVivo(simulacao) {
  const saida = {};
  for (const [id, valor] of Object.entries(simulacao || {})) {
    saida[id] = { estado: valor.estado, detalhe: valor.detalhe };
  }
  return saida;
}

function estadoDoNo(no) {
  const vivoAtual = vivo[no.id];
  if (vivoAtual?.estado) return { estado: vivoAtual.estado, detalhe: vivoAtual.detalhe || "" };
  return { estado: no.estado, detalhe: "" };
}

async function carregar() {
  try {
    const resposta = await api("/api/estado");
    state = resposta.state;
    vivo = mapaVivo(resposta.simulacao);
    for (const texto of resposta.avisos || []) aviso(texto, "alerta");
    arvore.definirEstado(state, vivo);
    marcarStatus("protótipo simulado · conectado", "ok");
  } catch (erro) {
    marcarStatus(`falha ao carregar: ${erro.message}`, "erro");
  }
}

setInterval(async () => {
  try {
    const resposta = await api("/api/vivo");
    vivo = mapaVivo(resposta.vivo);
    arvore?.definirVivo(vivo);
    if (selecionado) atualizarPainel(selecionado);
  } catch {
    /* reconexão é por releitura; falha silenciosa aqui não apaga nada (D33) */
  }
}, 900);

/* ── Painel lateral ─────────────────────────────────────────────────────── */

function abrirPainel(no) {
  selecionado = no;
  el("painel").classList.remove("oculto");
  atualizarPainel(no);
}

function fecharPainel() {
  selecionado = null;
  el("painel").classList.add("oculto");
  arvore?.selecionar(null);
}

function atualizarPainel(no) {
  const { estado, detalhe } = estadoDoNo(no);
  el("pn-titulo").textContent = no.titulo;
  el("pn-estado").textContent = `${ESTADO_ROTULO[estado] || estado}${detalhe ? ` · ${detalhe}` : ""}`;
  el("pn-papel").textContent = PAPEL_ROTULO[no.papel] || no.papel;
  el("pn-diretorio").textContent = no.diretorio || "não informado";
  el("pn-worktree").textContent = no.worktree || "nenhum";
  el("pn-sessao").textContent = no.sessionID || "sem sessão vinculada";
  el("pn-instrucoes").textContent = no.instrucoes || "—";
  el("pn-recolher").textContent = no.recolhido ? "Expandir galho" : "Recolher galho";
  el("pn-nota").textContent =
    estado === "nao_encontrado"
      ? "A sessão vinculada não existe mais. O nó permanece visível até você decidir o que fazer (D21)."
      : estado === "incerto"
        ? "Não foi possível confirmar o estado real deste nó. Verifique antes de agir (D32)."
        : no.simulado
          ? "Nó simulado: nenhuma sessão real está associada."
          : "";
}

/* ── Popup de criação ───────────────────────────────────────────────────── */

const fluxo = {
  etapa: 1,
  origemId: null,
  titulo: "",
  instrucoes: "",
  criarWorktree: null,
  cadastroIndex: 0,
  worktreeExistente: "",
  referencia: "main",
  nome: "",
  destino: "",
  conflito: null,
  confirmarConflito: false,
};

function abrirPopup(origemId) {
  fluxo.etapa = 1;
  fluxo.origemId = origemId;
  fluxo.titulo = "";
  fluxo.instrucoes = "";
  fluxo.criarWorktree = null;
  fluxo.cadastroIndex = 0;
  fluxo.worktreeExistente = "";
  fluxo.referencia = "main";
  fluxo.nome = "";
  fluxo.destino = "";
  fluxo.conflito = null;
  fluxo.confirmarConflito = false;
  renderPopup();
  el("popup").dataset.aberto = "true";
}

function fecharPopup() {
  el("popup").dataset.aberto = "false";
  el("pp-corpo").innerHTML = "";
  el("pp-acoes").innerHTML = "";
  el("pp-aviso").textContent = "";
}

function botao(texto, tipo, acao) {
  const b = document.createElement("button");
  b.textContent = texto;
  if (tipo) b.className = tipo;
  b.type = "button";
  b.addEventListener("click", acao);
  return b;
}

function campo(rotulo, controle, dica) {
  const caixa = document.createElement("div");
  caixa.className = "campo";
  const rot = document.createElement("label");
  rot.textContent = rotulo;
  caixa.appendChild(rot);
  caixa.appendChild(controle);
  if (dica) {
    const d = document.createElement("div");
    d.className = "dica-campo";
    d.textContent = dica;
    caixa.appendChild(d);
  }
  return caixa;
}

function entradaTexto(valor, placeholder = "") {
  const i = document.createElement("input");
  i.type = "text";
  i.value = valor;
  i.placeholder = placeholder;
  i.addEventListener("input", () => {
    fluxo.titulo = i.value;
  });
  return i;
}

function opcaoRadio(nome, valor, marcado, titulo, descricao) {
  const rotulo = document.createElement("label");
  rotulo.className = "opcao";
  const r = document.createElement("input");
  r.type = "radio";
  r.name = nome;
  r.value = valor;
  r.checked = marcado;
  r.addEventListener("change", () => {
    fluxo.criarWorktree = valor === "sim";
  });
  const texto = document.createElement("div");
  const forte = document.createElement("strong");
  forte.textContent = titulo;
  const pequeno = document.createElement("small");
  pequeno.textContent = descricao;
  texto.appendChild(forte);
  texto.appendChild(pequeno);
  rotulo.appendChild(r);
  rotulo.appendChild(texto);
  return rotulo;
}

function selecaoCadastros() {
  const s = document.createElement("select");
  state.cadastros.forEach((cadastro, indice) => {
    const o = document.createElement("option");
    o.value = String(indice);
    o.textContent = cadastro.rotulo || cadastro.caminho;
    s.appendChild(o);
  });
  const outro = document.createElement("option");
  outro.value = "sem-diretorio";
  outro.textContent = "nenhum diretório (o popup perguntaria depois)";
  s.appendChild(outro);
  s.value = String(Math.min(fluxo.cadastroIndex, state.cadastros.length - 1));
  s.addEventListener("change", () => {
    fluxo.cadastroIndex = Number.parseInt(s.value, 10);
  });
  return s;
}

function resumoContexto() {
  if (fluxo.criarWorktree) {
    const cadastro = state.cadastros[fluxo.cadastroIndex];
    return {
      linhas: [
        ["Repositório", cadastro?.rotulo || cadastro?.caminho || "—"],
        ["Referência de origem", fluxo.referencia || "—"],
        ["Nome do worktree", fluxo.nome || "—"],
        ["Destino", fluxo.destino || "definido pelo projeto (a estratégia decide)"],
        ["Worktree existente informado", fluxo.worktreeExistente || "nenhum"],
      ],
      notaWorktree:
        "Criar um worktree carrega a configuração e os plugins do diretório canônico do projeto, " +
        "ou seja, pode executar a preparação definida por ele. Nada aqui é apresentado como " +
        "“apenas criar uma pasta” (D30).",
    };
  }
  const cadastro = fluxo.cadastroIndex >= 0 ? state.cadastros[fluxo.cadastroIndex] : null;
  const semDiretorio = fluxo.cadastroIndex < 0 || !state.cadastros.length;
  return {
    linhas: [
      ["Diretório", semDiretorio ? "nenhum (seria perguntado depois)" : cadastro.rotulo || cadastro.caminho],
      ["Worktree existente informado", fluxo.worktreeExistente || "nenhum"],
    ],
    notaWorktree:
      "Alterações não commitadas não migram para um novo worktree: elas continuam no diretório " +
      "original. O painel apenas informa; a decisão é sua (D29).",
  };
}

function renderPopup() {
  const corpo = el("pp-corpo");
  const acoes = el("pp-acoes");
  const avisoAlvo = el("pp-aviso");
  corpo.innerHTML = "";
  acoes.innerHTML = "";
  avisoAlvo.textContent = "";
  avisoAlvo.className = "popup-aviso";

  const origem = state.nos.find((n) => n.id === fluxo.origemId);
  const origemTexto = origem ? ` a partir de “${origem.titulo}”` : "";

  if (fluxo.etapa === 1) {
    el("pp-titulo").textContent = `Novo chat${origemTexto}`;
    el("pp-etapa").textContent = "Etapa 1 de 4 · tarefa e instruções";
    corpo.appendChild(campo("Título", entradaTexto(fluxo.titulo, "ex.: revisar a ponte local")));
    caixaTextarea(corpo, "Instruções de entrada (opcional)", fluxo.instrucoes, (valor) => {
      fluxo.instrucoes = valor;
    });
    const nota = document.createElement("div");
    nota.className = "dica-campo";
    nota.textContent =
      "O chat começa novo, sem histórico herdado do chat de origem. As instruções são suas e " +
      "são inseridas só porque você as escreveu aqui (D04).";
    corpo.appendChild(nota);
    acoes.appendChild(botao("Cancelar", "", fecharPopup));
    acoes.appendChild(botao("Continuar", "primario", () => {
      if (!fluxo.titulo.trim()) {
        avisoAlvo.textContent = "Informe um título para continuar.";
        avisoAlvo.className = "popup-aviso erro";
        return;
      }
      fluxo.etapa = 2;
      renderPopup();
    }));
    return;
  }

  if (fluxo.etapa === 2) {
    el("pp-titulo").textContent = "Criar novo worktree?";
    el("pp-etapa").textContent = "Etapa 2 de 4 · isolamento";
    const opcoes = document.createElement("div");
    opcoes.className = "opcoes";
    opcoes.appendChild(
      opcaoRadio(
        "worktree",
        "nao",
        fluxo.criarWorktree === false,
        "Não",
        "usar uma pasta ou worktree já existente. Nada é criado.",
      ),
    );
    opcoes.appendChild(
      opcaoRadio(
        "worktree",
        "sim",
        fluxo.criarWorktree === true,
        "Sim",
        "criar um worktree novo. A operação pode executar a preparação do projeto (D30).",
      ),
    );
    corpo.appendChild(opcoes);
    const nota = document.createElement("div");
    nota.className = "dica-campo";
    nota.textContent =
      "Criar um chat não isola arquivos; criar um worktree não copia histórico. As duas coisas " +
      "continuam sendo operações distintas, mesmo apresentadas no mesmo fluxo.";
    corpo.appendChild(nota);
    acoes.appendChild(botao("Voltar", "", () => {
      fluxo.etapa = 1;
      renderPopup();
    }));
    acoes.appendChild(botao("Continuar", "primario", () => {
      if (fluxo.criarWorktree === null) {
        avisoAlvo.textContent = "Escolha uma das opções.";
        avisoAlvo.className = "popup-aviso erro";
        return;
      }
      fluxo.etapa = 3;
      renderPopup();
    }));
    return;
  }

  if (fluxo.etapa === 3) {
    if (fluxo.criarWorktree) {
      el("pp-titulo").textContent = "Novo worktree";
      el("pp-etapa").textContent = "Etapa 3 de 4 · repositório, origem e destino";
      const cadastro = state.cadastros[Math.min(fluxo.cadastroIndex, state.cadastros.length - 1)];

      const selRepo = selecaoCadastros();
      selRepo.addEventListener("change", () => {
        const escolhido = state.cadastros[Number.parseInt(selRepo.value, 10)];
        fluxo.cadastroIndex = Number.parseInt(selRepo.value, 10);
        if (escolhido && !fluxo.nome) fluxo.nome = sugestaoNome(escolhido);
        renderPopup();
      });
      corpo.appendChild(campo("Repositório", selRepo));

      const ref = document.createElement("input");
      ref.type = "text";
      ref.value = fluxo.referencia;
      ref.addEventListener("input", () => {
        fluxo.referencia = ref.value;
      });
      corpo.appendChild(
        campo(
          "Referência de origem (branch ou tag)",
          ref,
          "Nenhuma operação assume main em silêncio: a referência precisa ser escolhida aqui (D28).",
        ),
      );

      if (!fluxo.nome) fluxo.nome = sugestaoNome(cadastro);
      const nome = document.createElement("input");
      nome.type = "text";
      nome.value = fluxo.nome;
      nome.addEventListener("input", () => {
        fluxo.nome = nome.value;
      });
      corpo.appendChild(campo("Nome do worktree", nome, "Sugestão a partir do título; sempre editável."));

      const destino = document.createElement("input");
      destino.type = "text";
      destino.value = fluxo.destino;
      destino.placeholder = "vazio = usar o destino configurado pelo projeto";
      destino.addEventListener("input", () => {
        fluxo.destino = destino.value;
      });
      corpo.appendChild(
        campo(
          "Destino (opcional)",
          destino,
          "O painel não impõe destino: o que o projeto configurou sempre vence (D28).",
        ),
      );

      const nota = document.createElement("div");
      nota.className = "dica-campo";
      nota.textContent = resumoContexto().notaWorktree;
      corpo.appendChild(nota);
    } else {
      el("pp-titulo").textContent = "Contexto de trabalho";
      el("pp-etapa").textContent = "Etapa 3 de 4 · pasta ou worktree existente";
      fluxo.cadastroIndex = Math.min(fluxo.cadastroIndex, state.cadastros.length - 1);
      const sel = selecaoCadastros();
      sel.addEventListener("change", () => {
        fluxo.cadastroIndex = Number.parseInt(sel.value, 10);
      });
      corpo.appendChild(campo("Diretório cadastrado", sel));

      const wt = document.createElement("input");
      wt.type = "text";
      wt.value = fluxo.worktreeExistente;
      wt.placeholder = "ex.: /caminho/para/worktree-existente (opcional)";
      wt.addEventListener("input", () => {
        fluxo.worktreeExistente = wt.value;
      });
      corpo.appendChild(
        campo(
          "Worktree existente (opcional)",
          wt,
          "Vincular um worktree já existente não muda a branch dele.",
        ),
      );

      const nota = document.createElement("div");
      nota.className = "dica-campo";
      nota.textContent = resumoContexto().notaWorktree;
      corpo.appendChild(nota);
    }

    acoes.appendChild(botao("Voltar", "", () => {
      fluxo.etapa = 2;
      renderPopup();
    }));
    acoes.appendChild(botao("Continuar", "primario", () => {
      fluxo.conflito = fluxo.worktreeExistente
        ? state.ocupacaoWorktree.find((o) => o.worktree === fluxo.worktreeExistente) || null
        : null;
      fluxo.confirmarConflito = false;
      fluxo.etapa = 4;
      renderPopup();
    }));
    return;
  }

  // Etapa 4 — confirmação
  el("pp-titulo").textContent = "Confirmar";
  el("pp-etapa").textContent = "Etapa 4 de 4 · revisão antes de criar";
  const { linhas, notaWorktree } = resumoContexto();

  const resumo = document.createElement("dl");
  resumo.className = "painel-corpo";
  resumo.innerHTML = "";

  const adicionarLinha = (rotulo, valor) => {
    const div = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = rotulo;
    const dd = document.createElement("dd");
    dd.textContent = valor;
    div.appendChild(dt);
    div.appendChild(dd);
    resumo.appendChild(div);
  };

  adicionarLinha("Título", fluxo.titulo);
  adicionarLinha("Instruções", fluxo.instrucoes || "—");
  for (const [rotulo, valor] of linhas) adicionarLinha(rotulo, valor);
  corpo.appendChild(resumo);

  const nota = document.createElement("div");
  nota.className = "dica-campo";
  nota.textContent = notaWorktree;
  corpo.appendChild(nota);

  if (fluxo.conflito) {
    const ocupante = state.nos.find((n) => n.id === fluxo.conflito.noID);
    const bloqueio = document.createElement("div");
    bloqueio.className = "aviso-bloqueio";
    const texto = document.createElement("div");
    texto.textContent =
      `Este worktree já está vinculado ao nó “${ocupante ? ocupante.titulo : fluxo.conflito.noID}”. ` +
      "Compartilhar exige confirmação explícita; o conflito não fica oculto (D27).";
    const confirmar = document.createElement("label");
    confirmar.className = "opcao";
    const caixa = document.createElement("input");
    caixa.type = "checkbox";
    caixa.checked = fluxo.confirmarConflito;
    caixa.addEventListener("change", () => {
      fluxo.confirmarConflito = caixa.checked;
    });
    const textoCaixa = document.createElement("div");
    const forte = document.createElement("strong");
    forte.textContent = "Entendo e quero compartilhar assim mesmo";
    textoCaixa.appendChild(forte);
    confirmar.appendChild(caixa);
    confirmar.appendChild(textoCaixa);
    bloqueio.appendChild(texto);
    bloqueio.appendChild(confirmar);
    corpo.appendChild(bloqueio);
  }

  const alerta = document.createElement("div");
  alerta.className = "dica-campo";
  alerta.textContent =
    "Protótipo: o nó é criado apenas no registro do painel. Nenhuma sessão, worktree ou branch " +
    "é criado no OpenCode ou no Git nesta etapa.";
  corpo.appendChild(alerta);

  acoes.appendChild(botao("Voltar", "", () => {
    fluxo.etapa = 3;
    renderPopup();
  }));
  acoes.appendChild(botao("Cancelar", "", fecharPopup));
  acoes.appendChild(
    botao("Criar chat", "primario", async () => {
      if (fluxo.conflito && !fluxo.confirmarConflito) {
        avisoAlvo.textContent = "Confirme o compartilhamento do worktree ou volte para escolher outro.";
        avisoAlvo.className = "popup-aviso erro";
        return;
      }
      await criarNo();
    }),
  );
}

function caixaTextarea(pai, rotulo, valor, aoDigitar) {
  const caixa = document.createElement("div");
  caixa.className = "campo";
  const rot = document.createElement("label");
  rot.textContent = rotulo;
  const area = document.createElement("textarea");
  area.value = valor;
  area.addEventListener("input", () => aoDigitar(area.value));
  caixa.appendChild(rot);
  caixa.appendChild(area);
  pai.appendChild(caixa);
}

function sugestaoNome(cadastro) {
  const base = fluxo.titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const sufixo = Date.now().toString(36).slice(-4);
  const projeto = cadastro ? `-${(cadastro.rotulo || cadastro.caminho).toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "";
  return `${base || "chat"}${projeto}-${sufixo}`;
}

async function criarNo() {
  if (!state) return;
  const cadastro = fluxo.cadastroIndex >= 0 ? state.cadastros[fluxo.cadastroIndex] : null;
  const diretorio = !fluxo.criarWorktree && cadastro ? cadastro.caminho : null;
  const worktree = fluxo.criarWorktree ? null : fluxo.worktreeExistente || null;

  const no = {
    id: `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    titulo: fluxo.titulo.trim(),
    papel: "livre",
    grupoPai: fluxo.origemId,
    sessionID: null,
    diretorio,
    worktree,
    instrucoes: fluxo.instrucoes,
    simulado: true,
    estado: "vazio",
    posicao: { x: 0, y: 0 },
    recolhido: false,
  };

  state.nos.push(no);
  if (worktree) {
    state.ocupacaoWorktree.push({
      worktree,
      noID: no.id,
      confirmadoEm: new Date().toISOString(),
    });
  }

  const ok = await salvar("Nó criado apenas no painel (protótipo). Nenhuma sessão foi criada no OpenCode.");
  fecharPopup();
  if (ok) {
    arvore.definirEstado(state, vivo);
    arvore.focar(no.id);
    abrirPainel(state.nos.find((n) => n.id === no.id));
  }
}

/* ── Ações do painel ────────────────────────────────────────────────────── */

async function marcarDependencia() {
  if (!selecionado) return;
  const outros = state.nos.filter((n) => n.id !== selecionado.id);
  if (!outros.length) {
    aviso("Não há outro nó para apontar como dependência.", "alerta");
    return;
  }
  const escolha = window.prompt(
    `Depende de qual nó?\n\n${outros.map((n, i) => `${i + 1}. ${n.titulo}`).join("\n")}`,
  );
  if (!escolha) return;
  const indice = Number.parseInt(escolha, 10) - 1;
  const destino = outros[indice];
  if (!destino) {
    aviso("Escolha inválida; nada foi alterado.", "erro");
    return;
  }
  const existe = state.dependencias.some(
    (d) => d.origem === selecionado.id && d.destino === destino.id,
  );
  if (existe) {
    aviso("Essa dependência já existe.", "alerta");
    return;
  }
  state.dependencias.push({ origem: selecionado.id, destino: destino.id });
  await salvar("Dependência registrada apenas no painel.");
}

async function removerVinculo() {
  if (!selecionado) return;
  const no = selecionado;
  const confirmado = window.confirm(
    `Remover o vínculo visual de “${no.titulo}”?\n\n` +
      "Isso apaga o nó do registro do painel. A sessão, a branch e o worktree " +
      "continuam existindo onde estão.",
  );
  if (!confirmado) return;
  state.nos = state.nos.filter((n) => n.id !== no.id);
  state.dependencias = state.dependencias.filter((d) => d.origem !== no.id && d.destino !== no.id);
  state.ocupacaoWorktree = state.ocupacaoWorktree.filter((o) => o.noID !== no.id);
  fecharPainel();
  await salvar("Vínculo visual removido. Nenhum recurso externo foi tocado.");
}

/* ── Inicialização ──────────────────────────────────────────────────────── */

function iniciar() {
  arvore = criarArvore(el("arvore"), {
    onSelecionar: (no) => {
      if (no) abrirPainel(no);
      else fecharPainel();
    },
    onAcao: (tipo) => {
      if (tipo === "menu" && selecionado) abrirPopup(selecionado.id);
    },
  });

  el("btn-novo").addEventListener("click", () => abrirPopup(selecionado?.id ?? null));
  el("pn-fechar").addEventListener("click", fecharPainel);
  el("pn-ramificar").addEventListener("click", () => {
    if (selecionado) abrirPopup(selecionado.id);
  });
  el("pn-dependencia").addEventListener("click", marcarDependencia);
  el("pn-remover").addEventListener("click", removerVinculo);
  el("pn-recolher").addEventListener("click", async () => {
    if (!selecionado) return;
    selecionado.recolhido = !selecionado.recolhido;
    arvore.definirEstado(state, vivo);
    atualizarPainel(selecionado);
    await salvar();
  });
  el("pn-abrir").addEventListener("click", () => {
    aviso("Abrir no OpenCode chega na Etapa 3, com a integração validada.", "alerta");
  });

  el("btn-recolher").addEventListener("click", async () => {
    const algumAberto = state.nos.some((n) => !n.recolhido && state.nos.some((f) => f.grupoPai === n.id));
    for (const no of state.nos) {
      if (state.nos.some((f) => f.grupoPai === no.id)) no.recolhido = algumAberto;
    }
    arvore.definirEstado(state, vivo);
    await salvar();
  });
  el("btn-zoom-menos").addEventListener("click", () => arvore.aplicarZoom(0.85));
  el("btn-zoom-mais").addEventListener("click", () => arvore.aplicarZoom(1.18));
  el("btn-centralizar").addEventListener("click", () => arvore.centrar());

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") {
      if (el("popup").dataset.aberto === "true") fecharPopup();
      else fecharPainel();
    }
  });

  if (!TOKEN) {
    marcarStatus("token ausente na URL — reabra o link impresso pela ponte", "erro");
  }

  void carregar();
}

iniciar();
