/**
 * app.js — interface do protótipo (Etapa 2).
 *
 * A UI consulta somente a ponte local. Criação de módulos é visual; não
 * cria sessões/worktrees nem acessa o vault. A ponte conserva a integração
 * somente leitura com o OpenCode.
 */

import { criarArvore, naipeDe } from "./tree.js";
import { organizarNavegacao } from "./navigation.mjs";
import { criarRamoDaConexao } from "./connections.mjs";

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

const uiRoot=document.getElementById("app-shell");
let state = null;
let vivo = {};
let arvore = null;
let enquadramentoInicialFeito = false;
let selecionado = null;
let focoAnteriorPopup = null;
let falhaDesenho = false;
let opencode = { modo: "simulado", conectado: false, nSessoes: 0, nProjetos: 0, atualizadoEm: null, erro: null };

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
  if (falhaDesenho) {
    texto = "falha no desenho — recarregue o painel; detalhes no console";
    tipo = "erro";
  }
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

let filaSalvamentos=Promise.resolve(),revisaoVisual=0;
function salvar(mensagem) {
  const revisao=++revisaoVisual;
  const tarefa=filaSalvamentos.then(()=>salvarAgora(mensagem,revisao));
  filaSalvamentos=tarefa.catch(()=>{});
  return tarefa;
}
async function salvarAgora(mensagem,revisao) {
  try {
    const snapshot=JSON.parse(JSON.stringify(state));
    const resposta = await api("/api/estado", { method: "POST", corpo: { state:snapshot } });
    if(revisao===revisaoVisual)state = resposta.state || state;
    if(selecionado)selecionado=state.nos.find(no=>no.id===selecionado.id) || null;
    arvore?.definirEstado(state, mapaVivo(resposta.simulacao));
    atualizarExplorador();
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
    // `desde` alimenta a energia do nó (tamanho por atividade); nada de
    // conteúdo privado viaja aqui, só estado, detalhe e instante (D23).
    saida[id] = { estado: valor.estado, detalhe: valor.detalhe, desde: valor.desde };
  }
  return saida;
}

function estadoDoNo(no) {
  const vivoAtual = vivo[no.id];
  if (vivoAtual?.estado) return { estado: vivoAtual.estado, detalhe: vivoAtual.detalhe || "" };
  return { estado: no.estado, detalhe: "" };
}

function atualizarFonte() {
  const alvo = el("fonte");
  if (alvo) {
    alvo.textContent =
      opencode.modo === "real"
        ? `Fase B · dados reais · ${opencode.nSessoes} sessões`
        : "simulado · mock local";
  }
  const botao = el("btn-fonte");
  if (botao) botao.textContent = opencode.modo === "real" ? "Usar simulado" : "Usar dados reais";
}

function textoStatus() {
  if (opencode.modo !== "real") return "simulado · conectado";
  if (opencode.erro) return `real · ${opencode.erro}`;
  if (!opencode.conectado) return "real · conectando…";
  return `real · ${opencode.nSessoes} sessões · ${opencode.nProjetos} projetos`;
}

const NIVEIS_EFEITOS = ["cheio", "sutil", "desligado"];

function nivelEfeitosAtual() {
  const e = state?.preferencias?.efeitos;
  return NIVEIS_EFEITOS.includes(e) ? e : "cheio";
}

function atualizarBotaoEfeitos() {
  uiRoot.classList.toggle("movimento-reduzido",!movimentoUI());
  const botao = el("btn-efeitos");
  if (botao) botao.textContent = `Efeitos: ${nivelEfeitosAtual()}`;
}

async function alternarEfeitos() {
  if (!state) return;
  const proximo = NIVEIS_EFEITOS[(NIVEIS_EFEITOS.indexOf(nivelEfeitosAtual()) + 1) % NIVEIS_EFEITOS.length];
  state.preferencias = { ...(state.preferencias || {}), efeitos: proximo };
  arvore.definirEstado(state, vivo);
  atualizarBotaoEfeitos();
  await salvar();
}

async function carregar() {
  try {
    const resposta = await api("/api/estado");
    state = resposta.state;
    if(selecionado)selecionado=state.nos.find(no=>no.id===selecionado.id) || null;
    vivo = mapaVivo(resposta.simulacao);
    if (resposta.opencode) opencode = resposta.opencode;
    for (const texto of resposta.avisos || []) aviso(texto, "alerta");
    arvore.definirEstado(state, vivo);
    atualizarExplorador();
    if (!enquadramentoInicialFeito) {
      arvore.centrar();
      enquadramentoInicialFeito = true;
    }
    atualizarFonte();
    atualizarBotaoEfeitos();
    marcarStatus(textoStatus(), opencode.modo === "real" && !opencode.erro ? "ok" : opencode.erro ? "erro" : "ok");
    void mostrarVersao();
  } catch (erro) {
    marcarStatus(`falha ao carregar: ${erro.message}`, "erro");
  }
}

/** Carimbo do código servido: diz "que versão estou olhando?" num olhar. */
async function mostrarVersao() {
  try {
    const resposta = await api("/api/saude");
    const alvo = el("versao");
    if (alvo) alvo.textContent = resposta.versao ? `código ${resposta.versao}` : "código local";
  } catch {
    /* saúde indisponível não apaga a árvore (D33) */
  }
}

async function alternarFonte() {
  try {
    const proximo = opencode.modo === "real" ? "simulado" : "real";
    const resposta = await api("/api/opencode/modo", { method: "POST", corpo: { modo: proximo } });
    opencode = resposta;
    atualizarFonte();
    marcarStatus(textoStatus(), opencode.erro ? "erro" : "ok");
    if (opencode.erro) aviso(`OpenCode: ${opencode.erro}`, "erro");
    else aviso(proximo === "real" ? "Lendo sessões reais (somente leitura)." : "De volta ao simulado.", "ok");
    await carregar();
  } catch (erro) {
    aviso(`Não foi possível alternar a fonte: ${erro.message}`, "erro");
  }
}

async function ressincronizar() {
  try {
    const resposta = await api("/api/opencode/ressincronizar", { method: "POST", corpo: {} });
    opencode = resposta;
    atualizarFonte();
    marcarStatus(textoStatus(), opencode.erro ? "erro" : "ok");
    aviso(
      opencode.erro
        ? `Ressincronização falhou: ${opencode.erro}`
        : `Inventário relido: ${opencode.nSessoes} sessões, ${opencode.nProjetos} projetos.`,
      opencode.erro ? "erro" : "ok",
    );
  } catch (erro) {
    aviso(`Não foi possível ressincronizar: ${erro.message}`, "erro");
  }
}

setInterval(async () => {
  try {
    const resposta = await api("/api/vivo");
    vivo = mapaVivo(resposta.vivo);
    if (resposta.opencode) {
      opencode = resposta.opencode;
      atualizarFonte();
      marcarStatus(textoStatus(), opencode.erro ? "erro" : "");
    }
    arvore?.definirVivo(vivo);
    atualizarIndicadoresDoExplorador();
    if (selecionado) atualizarPainel(selecionado);
  } catch {
    /* reconexão é por releitura; falha silenciosa aqui não apaga nada (D33) */
  }
}, 900);

/* ── Painel lateral ─────────────────────────────────────────────────────── */

function fecharExplorador() {
  el("app-shell")?.classList.remove("nav-aberta");
  el("btn-explorador")?.setAttribute("aria-expanded", "false");
}

function atualizarIndicadoresDoExplorador() {
  const porId = new Map((state?.nos || []).map((no) => [no.id, no]));
  for (const botao of el("explorador-lista")?.querySelectorAll("[data-no-id]") || []) {
    const no = porId.get(botao.dataset.noId);
    if (!no) continue;
    const { estado } = estadoDoNo(no);
    const indicador = botao.querySelector(".estado");
    if (indicador) indicador.className = `estado ${estado}`;
    botao.setAttribute("aria-pressed", String(selecionado?.id === no.id));
    botao.setAttribute("aria-label", `${no.titulo} — ${ESTADO_ROTULO[estado] || estado}`);
  }
}

function atualizarExplorador() {
  const lista = el("explorador-lista");
  if (!lista || !state) return;
  const secoes = organizarNavegacao(state, el("busca-nos")?.value || "");
  const fragmento = document.createDocumentFragment();
  let total = 0;
  for (const { grupo, itens } of secoes) {
    const secao = document.createElement("section");
    secao.className = "grupo-nav";
    const titulo = document.createElement("button");
    titulo.type = "button";
    titulo.className = "grupo-nav-titulo";
    titulo.textContent = `◇  ${grupo.titulo}`;
    titulo.addEventListener("click", () => {
      if (grupo.id) arvore?.focar(grupo.id);
      else arvore?.centrar();
      fecharExplorador();
    });
    secao.appendChild(titulo);
    const filhos = document.createElement("ul");
    for (const { no, profundidade } of itens) {
      total += 1;
      const item = document.createElement("li");
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "no-nav";
      botao.dataset.noId = no.id;
      botao.style.paddingLeft = `${9 + Math.min(profundidade, 5) * 12}px`;
      botao.title = no.titulo;
      const naipe = document.createElement("span");
      naipe.className = "no-nav-naipe";
      naipe.setAttribute("aria-hidden", "true");
      naipe.textContent = naipeDe(no.papel) || "·";
      const nome = document.createElement("span");
      nome.className = "no-nav-titulo";
      nome.textContent = no.titulo;
      const indicador = document.createElement("i");
      indicador.className = "estado";
      indicador.setAttribute("aria-hidden", "true");
      botao.append(naipe, nome, indicador);
      botao.addEventListener("click", () => {
        // Revelar antecessores é navegação visual local, sem salvar ou tocar em sessões.
        let pai = state.nos.find((item) => item.id === no.grupoPai);
        const vistos = new Set([no.id]);
        while (pai && !vistos.has(pai.id)) {
          vistos.add(pai.id);
          pai.recolhido = false;
          pai = state.nos.find((item) => item.id === pai.grupoPai);
        }
        arvore.definirEstado(state, vivo);
        arvore.selecionar(no.id);
        arvore.focar(no.id);
        abrirPainel(no);
        fecharExplorador();
      });
      item.appendChild(botao);
      filhos.appendChild(item);
    }
    secao.appendChild(filhos);
    fragmento.appendChild(secao);
  }
  if (!total) {
    const vazio = document.createElement("p");
    vazio.className = "explorador-vazio";
    vazio.textContent = el("busca-nos")?.value ? "Nenhum nó encontrado." : "Sua organização ainda não tem nós.";
    fragmento.appendChild(vazio);
  }
  lista.replaceChildren(fragmento);
  atualizarListaConexoes();
  el("explorador-resumo").textContent = `${total} de ${state.nos.length} nós · ${state.grupos.length} espaços`;
  atualizarIndicadoresDoExplorador();
}

function abrirPainel(no) {
  el("painel-conexao")?.classList.add("oculto");conexaoAtual=null;
  selecionado = no;
  el("painel").classList.remove("oculto");
  el("painel-vazio")?.classList.add("oculto");
  el("app-shell")?.classList.add("no-selecionado");
  atualizarIndicadoresDoExplorador();
  atualizarPainel(no);
  revelarPainelAnimadoUI();
}

function fecharPainelSemAnimacao() {
  el("painel-conexao")?.classList.add("oculto");conexaoAtual=null;
  selecionado = null;
  el("painel").classList.add("oculto");
  el("painel-vazio")?.classList.remove("oculto");
  el("app-shell")?.classList.remove("no-selecionado");
  arvore?.selecionar(null);
  atualizarIndicadoresDoExplorador();
}

function atualizarPainel(no) {
  const { estado, detalhe } = estadoDoNo(no);
  el("pn-titulo").textContent = no.titulo;
  el("pn-estado").textContent = `${ESTADO_ROTULO[estado] || estado}${detalhe ? ` · ${detalhe}` : ""}`;
  el("pn-papel").value = no.papel || "livre";
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
  papel: "livre",
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
  focoAnteriorPopup = document.activeElement;
  fluxo.etapa = 1;
  fluxo.origemId = origemId;
  fluxo.titulo = "";
  fluxo.papel = "livre";
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
  el("popup").dataset.aberto = "true";abrirModalAnimadoUI(el("popup"));
  el("pp-corpo").querySelector("input, select, textarea, button")?.focus();
}

function fecharPopupSemAnimacao() {
  el("popup").dataset.aberto = "false";
  el("pp-corpo").innerHTML = "";
  el("pp-acoes").innerHTML = "";
  el("pp-aviso").textContent = "";
  focoAnteriorPopup?.focus?.();
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
  controle.id ||= `campo-${rotulo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  rot.htmlFor = controle.id;
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

function selecaoPapel(valor, aoEscolher) {
  const s = document.createElement("select");
  s.setAttribute("aria-label", "Papel organizacional");
  for (const [papel, rotulo] of Object.entries(PAPEL_ROTULO)) {
    const o = document.createElement("option");
    o.value = papel;
    o.textContent = `${naipeDe(papel)} ${rotulo}`.trim();
    s.appendChild(o);
  }
  s.value = valor;
  s.addEventListener("change", () => aoEscolher(s.value));
  return s;
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
  // Sentinela -1 preserva a escolha "sem diretório" entre etapas; NaN de
  // parseInt quebraria a seleção e o resumo (regressão: TypeError no passo 4).
  if (fluxo.cadastroIndex < 0 || !state.cadastros.length) s.value = "sem-diretorio";
  else s.value = String(Math.min(fluxo.cadastroIndex, state.cadastros.length - 1));
  s.addEventListener("change", () => {
    fluxo.cadastroIndex = s.value === "sem-diretorio" ? -1 : Number.parseInt(s.value, 10);
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
  const semDiretorio = fluxo.cadastroIndex < 0 || !state.cadastros.length || !cadastro;
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
  animarEtapaPopupUI();
  queueMicrotask(() => {
    if (el("popup").dataset.aberto === "true" && !el("popup").contains(document.activeElement)) {
      el("pp-corpo").querySelector("input, select, textarea, button")?.focus();
    }
  });
  for (const [indice, item] of [...(el("pp-progresso")?.children || [])].entries()) {
    if (indice + 1 === fluxo.etapa) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  }
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
    corpo.appendChild(campo("Papel / naipe", selecaoPapel(fluxo.papel, (papel) => { fluxo.papel = papel; }),
      "Etiqueta visual, não muda agente nem executa tarefas. Livre não tem naipe."));
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
        const escolhido = state.cadastros[fluxo.cadastroIndex];
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
      if (fluxo.cadastroIndex < -1 || Number.isNaN(fluxo.cadastroIndex)) fluxo.cadastroIndex = -1;
      corpo.appendChild(campo("Diretório cadastrado", selecaoCadastros()));

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
  adicionarLinha("Papel", `${naipeDe(fluxo.papel)} ${PAPEL_ROTULO[fluxo.papel]}`.trim());
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
  area.id = "instrucoes-novo-no";
  rot.htmlFor = area.id;
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
    papel: fluxo.papel,
    grupoPai: fluxo.origemId,
    sessionID: null,
    diretorio,
    worktree,
    instrucoes: fluxo.instrucoes,
    simulado: true,
    estado: "vazio",
    posicao: posicaoNovaRamificacao(fluxo.origemId),
    posicaoFixada:true,
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

function iniciar() {
  arvore = criarArvore(el("arvore"), {
    margemX: 88,
    margemY: 160,
    onOrganizar: salvarPosicoesOrganizadas,
    onSelecionarConexao: abrirConexao,
    onSelecionar: (no) => {
      if (no) abrirPainel(no);
      else fecharPainel();
    },
    onAcao: (tipo, no) => {
      if (tipo === "menu" && no) abrirPopup(no.id);
    },
    onErro: (erro) => {
      falhaDesenho = true;
      marcarStatus("falha no desenho — recarregue o painel; detalhes no console", "erro");
      console.error("TreeOffice: falha no desenho", erro);
    },
  });

  ligarControlesConexoes();ligarControlesLocal();ligarArrastoDialogosUI();
  el("btn-novo").addEventListener("click", () => abrirPopup(selecionado?.id ?? null));
  el("busca-nos")?.addEventListener("input", atualizarExplorador);
  el("btn-explorador")?.addEventListener("click", () => {
    const aberto = el("app-shell").classList.toggle("nav-aberta");
    el("btn-explorador").setAttribute("aria-expanded", String(aberto));
  });
  el("btn-fechar-explorador")?.addEventListener("click", fecharExplorador);
  el("pn-fechar").addEventListener("click", fecharPainel);
  const campoPapel = el("pn-papel");
  campoPapel.replaceChildren(...selecaoPapel("livre", () => {}).children);
  campoPapel.addEventListener("change", async () => {
    if (!selecionado || !PAPEL_ROTULO[campoPapel.value]) return;
    const no = selecionado;
    const anterior = no.papel;
    no.papel = campoPapel.value;
    campoPapel.disabled = true;
    const ok = await salvar("Papel visual atualizado; agente e sessão não foram alterados.");
    if (!ok) no.papel = anterior;
    campoPapel.disabled = false;
    if (selecionado?.id === no.id) atualizarPainel(no);
    arvore.definirEstado(state, vivo);
  });
  el("pn-ramificar").addEventListener("click", () => {
    if (selecionado) abrirPopup(selecionado.id);
  });
  el("pn-dependencia").addEventListener("click", marcarDependenciaLocal);
  el("pn-remover").addEventListener("click", removerVinculoLocal);
  el("pn-recolher").addEventListener("click", async () => {
    if (!selecionado) return;
    selecionado.recolhido = !selecionado.recolhido;
    arvore.definirEstado(state, vivo);
    atualizarPainel(selecionado);
    await salvar();
  });
  el("pn-abrir").addEventListener("click", () => {
    aviso("Abrir no OpenCode: na Fase B o painel só lê; a conversa continua na interface do OpenCode (D13).", "alerta");
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
  el("btn-fonte")?.addEventListener("click", alternarFonte);
  el("btn-ressinc")?.addEventListener("click", ressincronizar);
  el("btn-efeitos")?.addEventListener("click", alternarEfeitos);

  document.addEventListener("keydown", (evento) => {
    if (tratarTeclaDialogoLocal(evento)) return;
    if (evento.key === "Tab" && el("popup").dataset.aberto === "true") {
      const controles = [...el("popup").querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")];
      const primeiro = controles[0];
      const ultimo = controles[controles.length - 1];
      if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo?.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro?.focus(); }
    }
    if (evento.key === "Escape") {
      if (el("popup").dataset.aberto === "true") fecharPopup();
      else fecharPainel();
      fecharExplorador();
    }
  });

  if (!TOKEN) {
    marcarStatus("token ausente na URL — reabra o link impresso pela ponte", "erro");
  }

  void carregar();
}

let conexaoAtual=null;

function nomeDoExtremo(id) {
  return [...(state?.nos || []),...(state?.grupos || [])].find(n=>n.id===id)?.titulo || id;
}

function abrirConexao(info) {
  conexaoAtual=info; selecionado=null;
  el("painel").classList.add("oculto");
  el("painel-vazio").classList.add("oculto");
  el("painel-conexao").classList.remove("oculto");
  el("app-shell").classList.add("no-selecionado");
  el("lc-ramo-form").classList.add("oculto");
  el("lc-erro").textContent="";
  const meta=state.conexoesInfo?.[info.id] || {};
  el("lc-titulo").textContent=meta.nome || "Conexão";
  const fioPai=info.conexaoPai ? arvore.conexoes().find(c=>c.id===info.conexaoPai.id) : null;
  el("lc-origem").textContent=fioPai
    ? `Fio: ${nomeDoExtremo(fioPai.de)} → ${nomeDoExtremo(fioPai.para)} (${Math.round(info.conexaoPai.t*100)}%)`
    : nomeDoExtremo(info.de);
  el("lc-destino").textContent=nomeDoExtremo(info.para);
  el("lc-tipo").textContent=info.tipo;
  el("lc-ponto").textContent=`${Math.round(info.t*100)}% do caminho`;
  el("lc-total").textContent=String(state.nos.filter(n=>n.conexaoPai?.id===info.id).length);
  el("lc-nome").value=meta.nome || "";
  el("lc-notas").value=meta.notas || "";
  atualizarIndicadoresDoExplorador();
  atualizarListaConexoes();
  fecharExplorador();
  revelarPainelAnimadoUI();
}

function atualizarListaConexoes() {
  const lista=el("lista-conexoes");
  if (!lista || !state || !arvore) return;
  const fragmento=document.createDocumentFragment();
  for (const c of arvore.conexoes()) {
    const botao=document.createElement("button");
    botao.type="button";botao.className="no-nav conexao-nav";
    botao.textContent=state.conexoesInfo?.[c.id]?.nome || `${nomeDoExtremo(c.de)} → ${nomeDoExtremo(c.para)}`;
    botao.setAttribute("aria-label",`${c.tipo}: ${nomeDoExtremo(c.de)} para ${nomeDoExtremo(c.para)}`);
    botao.setAttribute("aria-pressed",String(conexaoAtual?.id===c.id));
    botao.addEventListener("click",()=>arvore.selecionarConexao(c.id));
    fragmento.append(botao);
  }
  lista.replaceChildren(fragmento);
}

function ligarControlesConexoes() {
  el("lc-fechar").addEventListener("click",fecharPainel);
  el("lc-ramificar").addEventListener("click",()=>{
    el("lc-ramo-form").classList.remove("oculto");
    el("lc-erro").textContent="";
    el("lc-ramo-nome").focus();
    el("lc-ramo-nome").scrollIntoView?.({block:"nearest",behavior:"smooth"});
  });
  el("lc-cancelar").addEventListener("click",()=>el("lc-ramo-form").classList.add("oculto"));
  const salvarInformacoes=async evento=>{
    evento?.preventDefault();
    if (!conexaoAtual) return;
    state.conexoesInfo ||= {};
    state.conexoesInfo[conexaoAtual.id]={nome:el("lc-nome").value.trim(),notas:el("lc-notas").value.trim()};
    await salvar("Informações da conexão salvas no painel.");
    abrirConexao(conexaoAtual);
  };
  let criando=false;
  const criarRamificacao=async evento=>{
    evento?.preventDefault();
    if (!conexaoAtual || criando) return;
    el("lc-erro").textContent="";
    if (!el("lc-ramo-nome").value.trim()) {
      el("lc-erro").textContent="Informe o nome do novo módulo.";
      el("lc-ramo-nome").focus();return;
    }
    criando=true;el("lc-criar").disabled=true;
    try {
      const no=criarRamoDaConexao(state,arvore,conexaoAtual,el("lc-ramo-nome").value,el("lc-ramo-papel").value);
      await salvar("Ramificação criada no painel.");
      el("lc-ramo-nome").value="";
      arvore.selecionar(no.id);arvore.focar(no.id);abrirPainel(no);
    } catch (erro) {el("lc-erro").textContent=erro.message;}
    finally {criando=false;el("lc-criar").disabled=false;}
  };
  el("lc-salvar").addEventListener("click",salvarInformacoes);
  el("lc-criar").addEventListener("click",criarRamificacao);
  el("lc-info-form").addEventListener("submit",salvarInformacoes);
  el("lc-ramo-form").addEventListener("submit",criarRamificacao);
  for (const [form,acao] of [[el("lc-info-form"),salvarInformacoes],[el("lc-ramo-form"),criarRamificacao]]) {
    form.addEventListener("keydown",evento=>{
      if (evento.key==="Enter" && evento.target.tagName!=="TEXTAREA" && evento.target.tagName!=="BUTTON") acao(evento);
    });
  }
}

let acaoDoDialogo=null,focoAntesDoDialogo=null;

function fecharDialogoSemAnimacaoLocal() {
  el("preview-dialog").dataset.aberto="false";
  acaoDoDialogo=null;
  if (focoAntesDoDialogo && uiRoot.contains(focoAntesDoDialogo) && !focoAntesDoDialogo.closest(".oculto")) focoAntesDoDialogo.focus();
  else el("btn-novo").focus();
}

function abrirDialogoLocal(titulo,conteudo,textoAcao,acao) {
  focoAntesDoDialogo=document.activeElement;
  el("preview-dialog-titulo").textContent=titulo;
  el("preview-dialog-corpo").replaceChildren(conteudo);
  el("preview-dialog-confirmar").textContent=textoAcao;
  el("preview-dialog-erro").textContent="";
  el("preview-dialog").dataset.aberto="true";
  abrirModalAnimadoUI(el("preview-dialog"));
  acaoDoDialogo=acao;
  (el("preview-dialog-corpo").querySelector("select,input,button") || el("preview-dialog-confirmar")).focus();
}

function marcarDependenciaLocal() {
  if (!selecionado) return;
  const origem=selecionado.id;
  const outros=state.nos.filter(n=>n.id!==origem);
  if (!outros.length) {aviso("Não há outro módulo para vincular.","alerta");return;}
  const caixa=document.createElement("div");caixa.className="campo";
  const label=document.createElement("label");label.textContent="Este módulo depende de";label.htmlFor="preview-dependencia";
  const select=document.createElement("select");select.id="preview-dependencia";
  for (const no of outros) {
    const option=document.createElement("option");option.value=no.id;option.textContent=no.titulo;select.append(option);
  }
  caixa.append(label,select);
  abrirDialogoLocal("Marcar dependência",caixa,"Adicionar dependência",async()=>{
    const destino=select.value;
    if (!state.nos.some(n=>n.id===origem)||!state.nos.some(n=>n.id===destino)) throw Error("Selecione um módulo válido.");
    if (state.dependencias.some(d=>d.origem===origem&&d.destino===destino)) throw Error("Essa dependência já existe.");
    state.dependencias.push({origem,destino});
    if (!await salvar("Dependência adicionada no painel.")) throw Error("Não foi possível salvar a dependência.");
    fecharDialogoLocal();
  });
}

function removerVinculoLocal() {
  if (!selecionado) return;
  const no=selecionado;
  const texto=document.createElement("p");texto.textContent=`Remover “${no.titulo}” do mapa? Os demais módulos serão mantidos.`;
  abrirDialogoLocal("Remover vínculo visual",texto,"Remover módulo",async()=>{
    state.nos=state.nos.filter(n=>n.id!==no.id);
    state.dependencias=state.dependencias.filter(d=>d.origem!==no.id&&d.destino!==no.id);
    state.ocupacaoWorktree=(state.ocupacaoWorktree || []).filter(o=>o.noID!==no.id);
    const invalidas=new Set([`ramo:${no.id}`]);
    for (const n of state.nos) {
      if (n.grupoPai===no.id) {n.grupoPai=null;invalidas.add(`ramo:${n.id}`);}
    }
    let mudou=true;
    while (mudou) {
      mudou=false;
      for (const n of state.nos) if (n.conexaoPai && (invalidas.has(n.conexaoPai.id)||n.conexaoPai.id.includes(`dep:${no.id}>`)||n.conexaoPai.id.endsWith(`>${no.id}`))) {
        delete n.conexaoPai;invalidas.add(`ramo:${n.id}`);mudou=true;
      }
    }
    fecharPainel();
    if (!await salvar("Módulo removido do painel.")) throw Error("Não foi possível salvar a remoção.");
    fecharDialogoLocal();
  });
}

function posicaoNovaRamificacao(origemId) {
  const p=arvore._debugPosicoes().find(p=>p.id===origemId) || arvore.camera();
  return {x:p.x+140,y:p.y+80};
}

function tratarTeclaDialogoLocal(evento) {
  if (el("preview-dialog").dataset.aberto!=="true") return false;
  if (evento.key==="Escape") {evento.preventDefault();fecharDialogoLocal();return true;}
  if (evento.key==="Tab") {
    const controles=[...el("preview-dialog").querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])")];
    const primeiro=controles[0],ultimo=controles.at(-1);
    if (evento.shiftKey && document.activeElement===primeiro) {evento.preventDefault();ultimo?.focus();}
    else if (!evento.shiftKey && document.activeElement===ultimo) {evento.preventDefault();primeiro?.focus();}
  }
  if (evento.key==="Enter" && evento.target.tagName==="SELECT") {evento.preventDefault();el("preview-dialog-confirmar").click();}
  return true;
}

function ligarControlesLocal() {
  el("preview-dialog-cancelar").addEventListener("click",fecharDialogoLocal);
  el("preview-dialog-confirmar").addEventListener("click",async()=>{
    if (!acaoDoDialogo || el("preview-dialog-confirmar").disabled) return;
    el("preview-dialog-confirmar").disabled=true;
    try {await acaoDoDialogo();}
    catch (erro) {el("preview-dialog-erro").textContent=erro.message;}
    finally {el("preview-dialog-confirmar").disabled=false;}
  });
  for (const summary of uiRoot.querySelectorAll("details > summary")) {
    summary.addEventListener("click",evento=>{
      evento.preventDefault();alternarDetalhesAnimadoUI(summary.parentElement);
    });
  }
}

// Transições inspiradas em Animate UI Dialog/Sheet, adaptadas à UI vanilla.
const animacoesUI=new WeakMap(),estadosModalUI=new WeakMap();
let tokenPainelUI=0;
function movimentoUI() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && state?.preferencias?.efeitos!=="desligado";
}
function interromperAnimacaoUI(elemento) {
  const animacao=animacoesUI.get(elemento);
  animacoesUI.delete(elemento);
  animacao?.cancel?.();
}
function animarUI(elemento,quadros,opcoes={},terminar=()=>{}) {
  interromperAnimacaoUI(elemento);
  if (!movimentoUI() || typeof elemento?.animate!=="function") {terminar();return null;}
  const animacao=elemento.animate(quadros,{duration:280,easing:"cubic-bezier(.22,1,.36,1)",...opcoes});
  animacoesUI.set(elemento,animacao);
  animacao.finished.then(()=>{
    if (animacoesUI.get(elemento)!==animacao) return;
    animacoesUI.delete(elemento);terminar();
  }).catch(()=>{});
  return animacao;
}
function quadrosMolaUI(distancia=22,stiffness=150,damping=25) {
  const quadros=[];
  let x=1,v=0;
  for (let i=0;i<=80;i++) {
    if (i%2===0) quadros.push({
      offset:i/80,opacity:Math.max(0,Math.min(1,1-x)),
      transform:`translateY(${-distancia*x}px) scale(${1-0.035*x})`,
    });
    const dt=0.008;v+=(-stiffness*x-damping*v)*dt;x+=v*dt;
  }
  quadros.at(-1).opacity=1;quadros.at(-1).transform="translateY(0px) scale(1)";
  return quadros;
}
function estadoModalUI(raiz) {
  if (!estadosModalUI.has(raiz)) estadosModalUI.set(raiz,{token:0,x:0,y:0,tx:0,ty:0,vx:0,vy:0,raf:null,ultimo:null});
  return estadosModalUI.get(raiz);
}
function ajustarPosicaoModalUI(raiz) {
  if (raiz.dataset.aberto!=="true") return;
  const s=estadoModalUI(raiz),box=raiz.querySelector(".popup");
  const r=uiRoot.getBoundingClientRect(),b=box.getBoundingClientRect();
  const limiteX=Math.max(0,(r.width-(box.offsetWidth||b.width))/2-12);
  const limiteY=Math.max(0,(r.height-(box.offsetHeight||b.height))/2-12);
  s.minX=-limiteX;s.maxX=limiteX;s.minY=-limiteY;s.maxY=limiteY;
  s.tx=Math.max(-limiteX,Math.min(limiteX,s.tx));s.ty=Math.max(-limiteY,Math.min(limiteY,s.ty));
  s.x=Math.max(-limiteX,Math.min(limiteX,s.x));s.y=Math.max(-limiteY,Math.min(limiteY,s.y));
  box.style.translate=`${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
}
function abrirModalAnimadoUI(raiz) {
  const estado=estadoModalUI(raiz);estado.token++;
  raiz.removeAttribute("data-saindo");raiz.inert=false;
  raiz.dataset.aberto="true";
  queueMicrotask(()=>ajustarPosicaoModalUI(raiz));
  animarUI(raiz,[{opacity:0},{opacity:1}],{duration:200,easing:"ease-in-out"});
  animarUI(raiz.querySelector(".popup"),quadrosMolaUI(),{duration:520,easing:"linear"});
}
function fecharModalAnimadoUI(raiz,terminar) {
  const estado=estadoModalUI(raiz),token=++estado.token;
  const box=raiz.querySelector(".popup");
  raiz.dataset.aberto="false";
  if (!movimentoUI() || typeof box?.animate!=="function") {raiz.removeAttribute("data-saindo");terminar();return;}
  raiz.setAttribute("data-saindo","true");raiz.inert=true;
  animarUI(raiz,[{opacity:1},{opacity:0}],{duration:180,easing:"ease-in"});
  animarUI(box,[{opacity:1,transform:"translateY(0px) scale(1)"},{opacity:0,transform:"translateY(12px) scale(.98)"}],{duration:180},()=>{
    if (estado.token!==token) return;
    raiz.removeAttribute("data-saindo");raiz.inert=false;terminar();
  });
}
function revelarPainelAnimadoUI() {
  tokenPainelUI++;
  el("app-shell").classList.remove("painel-saindo");
  const inspetor=el("inspetor");inspetor.inert=false;
  animarUI(inspetor,[{opacity:0,transform:"translateX(22px)"},{opacity:1,transform:"translateX(0px)"}],{duration:320});
}
function fecharPainelAnimadoUI(terminar) {
  const token=++tokenPainelUI,shell=el("app-shell"),inspetor=el("inspetor");
  arvore?.selecionar(null);
  if (!movimentoUI() || typeof inspetor.animate!=="function") {terminar();return;}
  shell.classList.add("painel-saindo");shell.classList.remove("no-selecionado");
  inspetor.inert=true;
  animarUI(inspetor,[{opacity:1,transform:"translateX(0px)"},{opacity:0,transform:"translateX(18px)"}],{duration:240},()=>{
    if (tokenPainelUI!==token) return;
    shell.classList.remove("painel-saindo");inspetor.inert=false;terminar();
  });
}
function animarEtapaPopupUI() {
  queueMicrotask(()=>{
    ajustarPosicaoModalUI(el("popup"));
    if (el("popup").dataset.aberto==="true") animarUI(el("pp-corpo"),[
      {opacity:0,transform:"translateX(12px)"},{opacity:1,transform:"translateX(0px)"},
    ],{duration:220});
  });
}
function alternarDetalhesAnimadoUI(details) {
  const conteudo=[...details.children].find(e=>e.tagName!=="SUMMARY");
  const fechando=details.dataset.saindo==="true";
  if (!details.hasAttribute("open") || fechando) {
    details.dataset.saindo="false";details.setAttribute("open","");
    animarUI(conteudo,[{opacity:0,transform:"translateY(-6px)"},{opacity:1,transform:"translateY(0px)"}],{duration:220});
  } else {
    details.dataset.saindo="true";
    animarUI(conteudo,[{opacity:1,transform:"translateY(0px)"},{opacity:0,transform:"translateY(-4px)"}],{duration:140},()=>{
      details.removeAttribute("open");details.dataset.saindo="false";
    });
  }
}
function ligarArrastoDialogosUI() {
  for (const id of ["popup","preview-dialog"]) {
    const raiz=el(id),box=raiz.querySelector(".popup"),handle=raiz.querySelector(".popup-cabecalho");
    const s=estadoModalUI(raiz);
    window.addEventListener("resize",()=>ajustarPosicaoModalUI(raiz));
    if(typeof ResizeObserver==="function")new ResizeObserver(()=>ajustarPosicaoModalUI(raiz)).observe(box);
    handle.classList.add("dialogo-arrastavel");
    const grip=document.createElement("span");grip.className="dialogo-grip";grip.textContent="⠿";grip.setAttribute("aria-hidden","true");handle.append(grip);
    const aplicar=()=>{box.style.translate=`${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;};
    const clamp=v=>Math.max(v.min,Math.min(v.max,v.valor));
    const avancar=tempo=>{
      const dt=s.ultimo===null?1/60:Math.min(0.034,Math.max(0.001,(tempo-s.ultimo)/1000));s.ultimo=tempo;
      if (!movimentoUI()) {s.x=s.tx;s.y=s.ty;s.vx=0;s.vy=0;}
      else for (let i=0;i<4;i++) {
        const passo=dt/4;
        s.vx+=(200*(s.tx-s.x)-25*s.vx)*passo;
        s.vy+=(200*(s.ty-s.y)-25*s.vy)*passo;
        s.x+=s.vx*passo;s.y+=s.vy*passo;
      }
      s.x=clamp({min:s.minX??-Infinity,max:s.maxX??Infinity,valor:s.x});
      s.y=clamp({min:s.minY??-Infinity,max:s.maxY??Infinity,valor:s.y});
      aplicar();
      if (Math.hypot(s.tx-s.x,s.ty-s.y)<0.08 && Math.hypot(s.vx,s.vy)<0.08) {
        s.x=s.tx;s.y=s.ty;s.vx=0;s.vy=0;s.raf=null;s.ultimo=null;aplicar();return;
      }
      s.raf=requestAnimationFrame(avancar);
    };
    const agendar=()=>{if (s.raf===null) s.raf=requestAnimationFrame(avancar);};
    handle.addEventListener("pointerdown",evento=>{
      if (evento.button!==0 || s.pointer!=null || evento.target.closest("button,input,select,textarea,a")) return;
      const r=uiRoot.getBoundingClientRect(),b=box.getBoundingClientRect();
      s.minX=r.left+12-(b.left-s.x);s.maxX=r.right-12-(b.right-s.x);
      s.minY=r.top+12-(b.top-s.y);s.maxY=r.bottom-12-(b.bottom-s.y);
      if(s.maxX<s.minX) s.minX=s.maxX=0;
      if(s.maxY<s.minY) s.minY=s.maxY=0;
      s.pointer=evento.pointerId;s.px=evento.clientX;s.py=evento.clientY;
      s.inicioX=s.tx;s.inicioY=s.ty;
      handle.setPointerCapture?.(evento.pointerId);handle.classList.add("arrastando");evento.preventDefault();
    });
    handle.addEventListener("pointermove",evento=>{
      if (evento.pointerId!==s.pointer) return;
      s.tx=clamp({min:s.minX,max:s.maxX,valor:s.inicioX+evento.clientX-s.px});
      s.ty=clamp({min:s.minY,max:s.maxY,valor:s.inicioY+evento.clientY-s.py});agendar();
    });
    const soltar=evento=>{
      if (evento.pointerId!==s.pointer) return;
      s.pointer=null;handle.classList.remove("arrastando");
      if(handle.hasPointerCapture?.(evento.pointerId))handle.releasePointerCapture(evento.pointerId);
      agendar();
    };
    handle.addEventListener("pointerup",soltar);handle.addEventListener("pointercancel",soltar);handle.addEventListener("lostpointercapture",soltar);
    handle.addEventListener("dblclick",()=>{s.tx=0;s.ty=0;s.minX=undefined;s.maxX=undefined;s.minY=undefined;s.maxY=undefined;agendar();});
  }
}

function fecharPopup(){fecharModalAnimadoUI(el("popup"),fecharPopupSemAnimacao);}
function fecharPainel(){fecharPainelAnimadoUI(fecharPainelSemAnimacao);}
function fecharDialogoLocal(){fecharModalAnimadoUI(el("preview-dialog"),fecharDialogoSemAnimacaoLocal);}
function salvarPosicoesOrganizadas(posicoes) {
  if(!state)return;
  const porId=new Map(posicoes.map(p=>[p.id,p]));
  for(const no of state.nos) {
    const pos=porId.get(no.id);
    if(pos){no.posicao={x:pos.x,y:pos.y};no.posicaoFixada=true;}
  }
  void salvar();
}

iniciar();
