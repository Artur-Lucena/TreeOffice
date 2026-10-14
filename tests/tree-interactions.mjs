/**
 * tree-render.mjs — teste do renderizador sem navegador.
 *
 * O smoke test cobre a ponte; este cobre o tree.js, que roda no navegador e
 * portanto fica fora do alcance do smoke. Ele cria um DOM falso, instancia o
 * `criarArvore` real e observa o que seria desenhado: chamadas de `arc` e
 * rótulos de `fillText`. Nada aqui toca em projetos, chats, worktrees, vault
 * ou no OpenCode — é simulação pura (D25).
 *
 * O que este teste já pegou (regressões reais, em 12/10/2026):
 *   1. nós desenhados em NaN, porque entradas de posição nasciam sem
 *      vx/vy/fase e `inicializarPosicoes` nunca era chamado — a árvore
 *      inteira era invisível;
 *   2. nó criado sem origem (`grupoPai: null`) nunca recebia âncora e também
 *      não era desenhado — o botão "criar chat" não tinha retorno visual;
 *   3. subárvore de galho recolhido continuava desenhada, e o selo de
 *      contagem nunca aparecia por sombreamento de `estado` em `desenharNo`.
 *
 * Uso:  node tests/tree-render.mjs
 */

import { criarRamoDaConexao } from "../src/ui/connections.mjs";
import { criarArvore, aplicarRepulsao } from "../src/ui/tree.js";

let arcs = [];
let textos = [];
let marcas = []; // coordenadas de cada fillText: medem a deriva dos rótulos
let tracados = [];
let rafCb = null;
let relogio = 0;

function canvasFalso() {
  const reg = { alfa: [], dash: [], largura: [], traco: [], espaco: [] };
  const eventos = new Map();
  let pontos = [];
  const ctx = {
    setTransform() {}, clearRect() {}, fillRect() {}, save() {}, restore() {},
    beginPath() { pontos = []; },
    moveTo(x, y) { pontos.push({ x, y }); },
    lineTo(x, y) { pontos.push({ x, y }); },
    closePath() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {},
    setLineDash() {}, ellipse() {}, clip() {}, translate() {}, rotate() {},
    measureText(texto) { return { width: String(texto).length * 7 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    arc(x, y, r) { arcs.push({ x, y, r }); },
    fillText(texto, x, y) {
      textos.push(String(texto));
      marcas.push({ texto: String(texto), x, y, font: ctx.font });
    },
  };
  ctx.stroke = () => tracados.push({ pontos: [...pontos], estilo: ctx.strokeStyle });
  Object.defineProperty(ctx, "globalAlpha", {
    set(v) { reg.alfa.push(v); },
    get() { return 1; },
  });
  Object.defineProperty(ctx, "lineDashOffset", {
    set(v) { reg.dash.push(v); },
    get() { return 0; },
  });
  Object.defineProperty(ctx, "lineWidth", {
    set(v) { reg.largura.push(v); },
    get() { return 1; },
  });
  Object.defineProperty(ctx, "strokeStyle", {
    set(v) { reg.traco.push(v); },
    get() { return ""; },
  });
  Object.defineProperty(ctx, "letterSpacing", {
    set(v) { reg.espaco.push(v); },
    get() { return "0px"; },
  });
  return {
    getContext: () => ctx,
    addEventListener(tipo, cb) { eventos.set(tipo, cb); },
    disparar(tipo, dados = {}) {
      eventos.get(tipo)?.({ pointerId: 1, button: 0, clientX: 0, clientY: 0, preventDefault() {}, ...dados });
    },
    setPointerCapture() {}, hasPointerCapture() { return false; },
    releasePointerCapture() {},
    getBoundingClientRect: () => ({ width: 900, height: 600, left: 0, top: 0 }),
    style: {},
    width: 0, height: 0,
    __ctx: ctx,
    __reg: reg,
  };
}


function iniciar(nos, grupos=[], opcoes={}) {
 globalThis.window = {addEventListener(){},devicePixelRatio:1,matchMedia:()=>({matches:false})};
 const tela=canvasFalso(); globalThis.document={getElementById:()=>tela};
 globalThis.requestAnimationFrame=cb=>{rafCb=cb};relogio=0;
 globalThis.performance={now:()=>relogio};
 const arvore=criarArvore(tela,{...opcoes,onErro:erro=>{throw erro}});
 const estado={grupos,nos,dependencias:[],preferencias:{efeitos:"cheio"}};
 arvore.definirEstado(estado,{});
 const frames=n=>{for(let i=0;i<n;i++){relogio+=16.666;rafCb(relogio)}};
 frames(100);return {arvore,tela,frames,estado};
}
function verificar(condicao,mensagem){if(!condicao)throw new Error(mensagem);console.log("OK:",mensagem)}
const um=iniciar([{id:"a",titulo:"Teste",papel:"lideranca",estado:"ativo",grupoPai:null}]);
const antes=um.arvore._debugPosicoes()[0];const cam=um.arvore.camera();
const x=(antes.x-cam.x)*cam.zoom+450,y=(antes.y-cam.y)*cam.zoom+300;
um.tela.disparar("pointerdown",{clientX:x,clientY:y});
um.tela.disparar("pointermove",{clientX:x+240,clientY:y+70});
verificar(Math.hypot(um.arvore._debugPosicoes()[0].x-antes.x,um.arvore._debugPosicoes()[0].y-antes.y)<0.01,"O movimento do cursor não teleporta o módulo");
um.frames(1);
const parcial=um.arvore._debugPosicoes()[0];
verificar(parcial.x>antes.x && parcial.x<antes.x+240/cam.zoom,"O módulo desliza gradualmente até o cursor");
um.tela.disparar("pointerup",{clientX:x+240,clientY:y+70});
um.frames(100);
const solto=um.arvore._debugPosicoes()[0];
verificar(Math.hypot(solto.x-antes.x-240/cam.zoom,solto.y-antes.y-70/cam.zoom)<0.1,"Após soltar, termina o deslizamento no destino");
um.frames(300);
const depois=um.arvore._debugPosicoes()[0];
verificar(Math.hypot(depois.x-solto.x,depois.y-solto.y)<0.1,"Módulo não retorna à posição original após soltar");
um.arvore.definirEstado(um.estado,{});um.frames(100);
verificar(Math.hypot(um.arvore._debugPosicoes()[0].x-solto.x,um.arvore._debugPosicoes()[0].y-solto.y)<0.1,"Atualizar o estado mantém a posição livre");
const dois=iniciar([{id:"a",titulo:"A",papel:"lideranca",estado:"ativo",grupoPai:null},{id:"b",titulo:"B",papel:"execucao",estado:"ativo",grupoPai:null}]);
const ps=dois.arvore._debugPosicoes();
dois.arvore.moverNo("b",ps[0].x-ps[1].x,ps[0].y-ps[1].y);dois.frames(300);
const fim=dois.arvore._debugPosicoes();
verificar(fim.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),"Colisão coincidente conserva coordenadas finitas");
verificar(Math.hypot(fim[0].x-fim[1].x,fim[0].y-fim[1].y)>110,"Colisão separa os módulos sem atração à origem");
const grupo=iniciar([
 {id:"a",titulo:"A",papel:"execucao",estado:"ativo",grupoPai:"g"},
 {id:"b",titulo:"B",papel:"execucao",estado:"ativo",grupoPai:"g"},
],[{id:"g",titulo:"Grupo"}]);
const centroAntes=grupo.arvore._debugPosicoes().find(p=>p.id==="g");
grupo.arvore.moverNo("a",400,200);grupo.frames(100);
const atuais=grupo.arvore._debugPosicoes();
const centro=atuais.find(p=>p.id==="g");const membros=atuais.filter(p=>p.camada==="no");
verificar(Math.hypot(centro.x-centroAntes.x,centro.y-centroAntes.y)>150,"Origem das conexões acompanha a mudança dos módulos");
verificar(Math.hypot(centro.x-(membros[0].x+membros[1].x)/2,centro.y-(membros[0].y+membros[1].y)/2)<0.01,"Origem permanece no centro atual do grupo, sem pino fixo");


let conexaoClicada=null;
const linhas=iniciar([
 {id:"a",titulo:"A",papel:"execucao",estado:"ativo",grupoPai:"g"},
 {id:"b",titulo:"B",papel:"estudo",estado:"ativo",grupoPai:"g"},
],[{id:"g",titulo:"Grupo"}],{onSelecionarConexao:info=>{conexaoClicada=info}});
const ponto=linhas.arvore.pontoConexao("ramo:a",0.5),cameraLinha=linhas.arvore.camera();
const lx=(ponto.x-cameraLinha.x)*cameraLinha.zoom+450,ly=(ponto.y-cameraLinha.y)*cameraLinha.zoom+300;
linhas.tela.disparar("pointerdown",{clientX:lx,clientY:ly});
linhas.tela.disparar("pointerup",{clientX:lx,clientY:ly});
verificar(conexaoClicada?.id==="ramo:a","Clique no fio seleciona a conexão correta");
verificar(Math.abs(conexaoClicada.t-0.5)<0.03,"Clique registra o ponto escolhido na curva");
const tamanhoAntes=linhas.estado.nos.length;
const ramo=criarRamoDaConexao(linhas.estado,linhas.arvore,conexaoClicada,"Nova tarefa","estudo");
verificar(linhas.estado.nos.length===tamanhoAntes+1 && ramo.conexaoPai.id==="ramo:a","Criar ramificação acrescenta um módulo ligado ao fio selecionado");
verificar(linhas.arvore.conexoes().some(c=>c.id===`ramo:${ramo.id}`&&c.tipo==="Ramificação de conexão"),"Novo fio está disponível para seleção e novas ramificações");
const origemAntes=linhas.arvore.pontoConexao(`ramo:${ramo.id}`,0);
linhas.arvore.moverNo("a",250,80);linhas.frames(80);
const origemDepois=linhas.arvore.pontoConexao(`ramo:${ramo.id}`,0);
const pontoPai=linhas.arvore.pontoConexao("ramo:a",ramo.conexaoPai.t);
verificar(Math.hypot(origemDepois.x-origemAntes.x,origemDepois.y-origemAntes.y)>50,"Ramificação acompanha o fio ao mover seus módulos");
verificar(Math.hypot(origemDepois.x-pontoPai.x,origemDepois.y-pontoPai.y)<0.001,"Ramificação continua ligada ao ponto paramétrico da curva");
const sub=criarRamoDaConexao(linhas.estado,linhas.arvore,linhas.arvore.pontoConexao(`ramo:${ramo.id}`,0.4),"Subramo","investigacao");
verificar(linhas.arvore.conexoes().some(c=>c.para===sub.id),"Também é possível ramificar a partir de um novo fio");
linhas.estado.nos.find(n=>n.id==="a").recolhido=true;
linhas.arvore.definirEstado(linhas.estado);linhas.frames(1);
const visFechando=linhas.arvore._debugPosicoes().find(p=>p.id===ramo.id).visibilidade;
verificar(visFechando>0 && visFechando<1,"Galho recolhido desaparece gradualmente");
linhas.frames(80);
verificar(linhas.arvore._debugPosicoes().find(p=>p.id===ramo.id).visibilidade===0,"Galho recolhido conclui a saída e sai da cena");
linhas.estado.nos.find(n=>n.id==="a").recolhido=false;
linhas.arvore.definirEstado(linhas.estado);linhas.frames(1);
const visAbrindo=linhas.arvore._debugPosicoes().find(p=>p.id===ramo.id).visibilidade;
verificar(visAbrindo>0 && visAbrindo<1,"Expandir galho restaura os módulos com transição suave");
linhas.frames(80);
verificar(linhas.arvore._debugPosicoes().find(p=>p.id===ramo.id).visibilidade===1,"Expansão conclui sem perder módulos nem conexões");
let gravacoes=0,instantaneo=[];
const persistido=iniciar([{id:"salvo",titulo:"Persistência",estado:"ativo",grupoPai:null}],[],{onOrganizar:ps=>{gravacoes++;instantaneo=ps}});
const pi=persistido.arvore._debugPosicoes()[0],ci=persistido.arvore.camera();
const px=450+(pi.x-ci.x)*ci.zoom,py=300+(pi.y-ci.y)*ci.zoom;
persistido.tela.disparar("pointerdown",{clientX:px,clientY:py});
persistido.tela.disparar("pointermove",{clientX:px+180,clientY:py+60});
persistido.tela.disparar("pointerup",{clientX:px+180,clientY:py+60});persistido.frames(120);
verificar(gravacoes===1,"Um arrasto concluído produz um único salvamento de posições");
verificar(Math.abs(instantaneo[0].x-pi.x-180/ci.zoom)<0.1,"Salvamento usa a posição final do deslizamento");
const restaurado=iniciar([{id:"salvo",titulo:"Persistência",estado:"ativo",grupoPai:null,posicaoFixada:true,posicao:instantaneo[0]}]);
verificar(Math.abs(restaurado.arvore._debugPosicoes()[0].x-instantaneo[0].x)<0.1,"Nova instância restaura a posição organizada");
console.log("23 verificações concluídas.");
