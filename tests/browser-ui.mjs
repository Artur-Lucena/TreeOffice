/**
 * Regressões no navegador REAL, não no Canvas falso.
 * Usa Chromium/Edge já instalado + CDP + WebSocket nativo (Node 22+).
 * Sem npm install. Perfil, árvore e capturas só em .local/testes-ui/.
 * Não conecta ao OpenCode, não usa perfil pessoal nem a árvore do usuário.
 * Uso: node tests/browser-ui.mjs [ou TREEOFFICE_BROWSER=/caminho/chromium]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { criarPonte } from "../src/server/bridge.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidatos = [process.env.TREEOFFICE_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
const binario = candidatos.find((p) => fs.existsSync(p));
if (!binario || typeof WebSocket !== "function") {
  console.error("Teste não executado: exige navegador Chromium instalado e Node 22+ (nenhum será instalado automaticamente).");
  process.exit(1);
}
const dir = path.join(raiz, ".local", "testes-ui");
fs.mkdirSync(dir, { recursive: true });
const execucao = fs.mkdtempSync(path.join(dir, "execucao-"));
let browser; let cdp; let ponte;
let passou = 0; let falhou = 0;
function verificar(nome, condicao, detalhe = "") {
  console.log(`  ${condicao ? "ok" : "FALHA"} ${nome}${!condicao && detalhe ? ` — ${detalhe}` : ""}`);
  condicao ? passou++ : falhou++;
  return condicao;
}
async function ate(condicao, prazo = 10000) {
  const limite = Date.now() + prazo;
  while (Date.now() < limite) {
    const valor = await condicao();
    if (valor) return valor;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Prazo excedido ao aguardar condição do teste.");
}
async function conectar(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let id = 0; const pendentes = new Map(); const observadores = new Map();
  ws.addEventListener("message", (evento) => {
    const msg = JSON.parse(evento.data);
    if (msg.id) {
      const p = pendentes.get(msg.id); if (!p) return;
      clearTimeout(p.timer); pendentes.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    } else for (const cb of observadores.get(msg.method) || []) cb(msg.params);
  });
  return {
    enviar(method, params = {}) {
      return new Promise((resolve, reject) => {
        const chave = ++id;
        const timer = setTimeout(() => { pendentes.delete(chave); reject(new Error(`CDP excedeu prazo: ${method}`)); }, 15000);
        pendentes.set(chave, { resolve, reject, timer });
        ws.send(JSON.stringify({ id: chave, method, params }));
      });
    },
    observar(method, cb) { const lista = observadores.get(method) || []; lista.push(cb); observadores.set(method, lista); },
    fechar() { ws.close(); },
  };
}
async function avaliar(expression) {
  const r = await cdp.enviar("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
const textoBotao = (texto) => avaliar(`document.querySelector('#pp-acoes').querySelectorAll('button').forEach(b => { if (b.textContent === ${JSON.stringify(texto)}) b.click(); })`);
const mouse = (type, x, y, buttons = 0) => cdp.enviar("Input.dispatchMouseEvent", { type, x, y, button: buttons || type === "mouseReleased" ? "left" : "none", buttons, clickCount: 1 });

try {
  ponte = criarPonte({ raiz: path.join(execucao, "arvore"), porta: 47183, fonte: "simulado" });
  await ponte.iniciar();
  const perfil = path.join(execucao, "perfil");
  browser = spawn(binario, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--disable-sync", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${perfil}`, "--window-size=1200,800", "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost", "about:blank"], { stdio: "ignore" });
  const portaArquivo = path.join(perfil, "DevToolsActivePort");
  await ate(() => fs.existsSync(portaArquivo));
  const debugPort = fs.readFileSync(portaArquivo, "utf8").split(/\r?\n/)[0];
  const alvos = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json());
  cdp = await conectar(alvos.find((p) => p.type === "page").webSocketDebuggerUrl);
  const erros = []; const respostas = [];
  cdp.observar("Runtime.exceptionThrown", (p) => erros.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
  cdp.observar("Network.responseReceived", (p) => respostas.push({ url: new URL(p.response.url).pathname, status: p.response.status }));
  await cdp.enviar("Page.enable"); await cdp.enviar("Runtime.enable"); await cdp.enviar("Network.enable");
  await cdp.enviar("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__marcas = new Map();
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(texto,x,y,...args) {
      if (this.canvas.id === 'arvore') window.__marcas.set(String(texto), {texto:String(texto),x,y,font:this.font});
      return original.call(this,texto,x,y,...args);
    };
  ` });
  await cdp.enviar("Page.navigate", { url: `http://127.0.0.1:47183/?token=${ponte.identidade().token}` });
  await ate(() => avaliar("window.__marcas && window.__marcas.size > 3"));
  console.log("\nTreeOffice — regressões em Chromium real, somente dados simulados");
  verificar("HTML, CSS e módulos carregam automaticamente por cookie", respostas.filter((r) => r.url.startsWith("/ui/")).every((r) => r.status === 200) && respostas.some((r) => r.url === "/ui/tree.js"));
  verificar("naipe desenhado no Canvas real, com fonte legível", await avaliar("[...window.__marcas.values()].some(m => /[♠♥♦♣]/.test(m.texto) && parseFloat(m.font)>=14)"));
  verificar("legenda ensina o significado sem depender de tooltip", await avaliar("/liderança/.test(document.getElementById('legenda').textContent)"));
  await ate(() => avaliar("document.getElementById('versao').textContent !== '…'"));
  verificar("carimbo do código visível", await avaliar("document.getElementById('versao').textContent.includes('código')"));

  await avaliar("document.getElementById('btn-novo').click()");
  verificar("botão abre popup", await avaliar("document.getElementById('popup').dataset.aberto==='true'"));
  const temPapel = verificar("popup permite escolher papel/naipe", await avaliar("!!document.querySelector('#pp-corpo select[aria-label=\"Papel organizacional\"]')"));
  // Frente E (E1, RED): ler arquivo do Tucofre como sugestão de instruções.
  fs.writeFileSync(path.join(execucao, "tucofre-teste.md"), "# Nota Tucofre\nLer antes de codar.\n");
  fs.writeFileSync(path.join(execucao, "tucofre-grande.md"), "x".repeat(5000));
  const temVault = await avaliar("!!document.getElementById('btn-vault') && !!document.getElementById('vault-arquivo')");
  verificar("etapa 1 oferece leitura de arquivo do Tucofre", temVault);
  if (temVault) {
    await cdp.enviar("DOM.enable");
    const docVault = await cdp.enviar("DOM.getDocument", { depth: 0 });
    const alvoVault = await cdp.enviar("DOM.querySelector", { nodeId: docVault.root.nodeId, selector: "#vault-arquivo" });
    await cdp.enviar("DOM.setFileInputFiles", { files: [path.join(execucao, "tucofre-teste.md")], nodeId: alvoVault.nodeId });
    verificar("arquivo do Tucofre vira sugestão editável", await ate(() => avaliar("document.getElementById('instrucoes-novo-no').value.includes('Ler antes de codar')")));
    await cdp.enviar("DOM.setFileInputFiles", { files: [path.join(execucao, "tucofre-grande.md")], nodeId: alvoVault.nodeId });
    verificar(
      "arquivo além do teto é cortado com aviso",
      await ate(async () => (await avaliar("document.getElementById('instrucoes-novo-no').value.length")) === 4000 && (await avaliar("document.getElementById('pp-aviso').textContent")).includes("4000")),
    );
  } else {
    verificar("arquivo do Tucofre vira sugestão editável", false);
    verificar("arquivo além do teto é cortado com aviso", false);
  }
  if (temPapel) {
    await avaliar(`{ document.querySelector('#pp-corpo input[type=text]').value='Investigação de teste'; document.querySelector('#pp-corpo input[type=text]').dispatchEvent(new Event('input')); const s=document.querySelector('#pp-corpo select[aria-label="Papel organizacional"]'); s.value='investigacao';s.dispatchEvent(new Event('change')); }`);
    await textoBotao("Continuar");
    await avaliar("{ const r=document.querySelector('#pp-corpo input[value=nao]');r.checked=true;r.dispatchEvent(new Event('change')); }");
    await textoBotao("Continuar");
    await avaliar("{ const s=document.querySelector('#pp-corpo select');s.value='sem-diretorio';s.dispatchEvent(new Event('change')); }");
    await textoBotao("Continuar"); await textoBotao("Criar chat");
    await ate(() => ponte.estadoAtual().nos.some((n) => n.titulo === "Investigação de teste"));
    verificar("papel escolhido persiste localmente sem criar sessão real", ponte.estadoAtual().nos.some((n) => n.titulo === "Investigação de teste" && n.papel === "investigacao" && !n.sessionID));
    verificar("nome do arquivo do Tucofre não é persistido", !JSON.stringify(ponte.estadoAtual()).includes("tucofre-"));
    verificar("painel permite trocar papel existente", await avaliar("document.getElementById('pn-papel').tagName==='SELECT'"));
    await avaliar("{ const s=document.getElementById('pn-papel');s.value='estudo';s.dispatchEvent(new Event('change')); }");
    await ate(() => ponte.estadoAtual().nos.some((n) => n.titulo === "Investigação de teste" && n.papel === "estudo"));
    verificar("troca de papel mostra ♣ no desenho", await ate(() => avaliar(`(()=>{const m=window.__marcas;const t=m.get("Investigação de teste");const e=m.get("♣");return !!(t&&e&&e.x===t.x);})()`)));
  }
  await avaliar("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  // Frente E (E2, RED): dependência criada e removida só por ação explícita.
  await avaliar("document.getElementById('btn-novo').click()");
  await ate(() => avaliar("!!document.querySelector('#pp-corpo input[type=text]')"));
  await avaliar("{document.querySelector('#pp-corpo input[type=text]').value='Apoio teste';document.querySelector('#pp-corpo input[type=text]').dispatchEvent(new Event('input'))}");
  await textoBotao("Continuar");
  await avaliar("{const r=document.querySelector('#pp-corpo input[value=nao]');r.checked=true;r.dispatchEvent(new Event('change'))}");
  await textoBotao("Continuar");
  await avaliar("{const s=document.querySelector('#pp-corpo select');s.value='sem-diretorio';s.dispatchEvent(new Event('change'))}");
  await textoBotao("Continuar"); await textoBotao("Criar chat");
  await ate(() => ponte.estadoAtual().nos.some((n) => n.titulo === "Apoio teste"));
  await avaliar("document.querySelectorAll('.no-nav')[0].click()");
  await ate(() => avaliar("!document.getElementById('painel').classList.contains('oculto')"));
  const depsAntes = ponte.estadoAtual().dependencias.length;
  await avaliar("document.getElementById('pn-dependencia').click()");
  await ate(() => avaliar("document.getElementById('preview-dialog').dataset.aberto==='true'"));
  await avaliar("{const s=document.getElementById('preview-dependencia');s.selectedIndex=s.options.length-1;s.dispatchEvent(new Event('change'))}");
  await avaliar("document.getElementById('preview-dialog-confirmar').click()");
  await ate(() => ponte.estadoAtual().dependencias.length === depsAntes + 1);
  verificar("dependência criada por ação explícita", ponte.estadoAtual().dependencias.length === depsAntes + 1);
  const temListaDeps = await avaliar("document.querySelectorAll('#pn-deps [data-dep]').length>=1 && !!document.querySelector('#pn-deps [data-remover-dep]')");
  verificar("inspetor lista a dependência com remoção explícita", temListaDeps);
  if (temListaDeps) {
    const novaDep = ponte.estadoAtual().dependencias[ponte.estadoAtual().dependencias.length - 1];
    const seletorLinha = `#pn-deps [data-dep="${novaDep.origem}>${novaDep.destino}"] [data-remover-dep]`;
    verificar("remoção mira a aresta criada", await avaliar(`!!document.querySelector(${JSON.stringify(seletorLinha)})`));
    await avaliar(`document.querySelector(${JSON.stringify(seletorLinha)}).click()`);
    await ate(() => avaliar("document.getElementById('preview-dialog').dataset.aberto==='true'"));
    await avaliar("document.getElementById('preview-dialog-confirmar').click()");
    await ate(() => ponte.estadoAtual().dependencias.length === depsAntes);
    verificar("dependência removida por ação explícita não volta", ponte.estadoAtual().dependencias.length === depsAntes);
  } else {
    verificar("dependência removida por ação explícita não volta", false);
  }

  // Frente B (B5, RED): importação seletiva de chats reais.
  const temAcompanhar = await avaliar("!!document.getElementById('btn-acompanhar')");
  verificar("cabeçalho oferece acompanhar chats", temAcompanhar);
  if (temAcompanhar) {
    await avaliar("document.getElementById('btn-acompanhar').click()");
    verificar("em simulado, importar pede dados reais", await ate(() => avaliar("document.getElementById('avisos').textContent.includes('dados reais')")));
  } else {
    verificar("em simulado, importar pede dados reais", false);
  }
  if (temAcompanhar) {
    const { default: httpImp } = await import("node:http");
    const baseImp = [
      { id: "ses_b1", projectID: "proj_b", title: "Beta real", outcome: null, time: { created: 1, updated: 5 } },
      ...Array.from({ length: 55 }, (_, i) => ({ id: `ses_a${i}`, projectID: "proj_a", title: `Alfa ${i}`, outcome: null, time: { created: 1, updated: 100 + i } })),
    ];
    const falsoImp = httpImp.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const out = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
      if (url.pathname === "/api/info") return out(200, { version: "imp" });
      if (url.pathname === "/api/project") return out(200, [{ id: "proj_a", canonical: "/fake/a" }, { id: "proj_b", canonical: "/fake/b" }]);
      if (url.pathname === "/api/session" && req.method === "GET") {
        const cursor = url.searchParams.get("cursor");
        const pagina = cursor === "p2" ? baseImp.slice(2) : baseImp.slice(0, 2);
        return out(200, { data: pagina, cursor: { previous: null, next: cursor ? null : "p2" } });
      }
      return out(404, {});
    });
    await new Promise((r) => falsoImp.listen(0, "127.0.0.1", r));
    const ponteImp = criarPonte({ raiz: path.join(execucao, "arvore-imp"), porta: 47185, fonte: "simulado", opencodeUrl: `http://127.0.0.1:${falsoImp.address().port}` });
    await ponteImp.iniciar();
    const tokenImp = ponteImp.identidade().token;
    const baseImpUrl = "http://127.0.0.1:47185";
    await fetch(`${baseImpUrl}/api/opencode/modo`, { method: "POST", headers: { authorization: `Bearer ${tokenImp}`, "content-type": "application/json", origin: baseImpUrl }, body: JSON.stringify({ modo: "real" }) });
    await cdp.enviar("Page.navigate", { url: `${baseImpUrl}/?token=${tokenImp}` });
    await ate(() => avaliar("document.getElementById('versao')?.textContent && document.getElementById('versao').textContent !== '…'"));
    await new Promise((r) => setTimeout(r, 1200));
    await avaliar("document.getElementById('btn-acompanhar').click()");
    await ate(() => avaliar("document.getElementById('preview-dialog').dataset.aberto==='true'"));
    await ate(() => avaliar("document.querySelectorAll('#import-lista input[type=checkbox]').length>0"), 15000);
    verificar("diálogo lista não vinculadas com teto de 50", await avaliar("document.querySelectorAll('#import-lista input[type=checkbox]').length===50"));
    await avaliar("{const s=document.getElementById('import-projeto');s.value='proj_b';s.dispatchEvent(new Event('change'))}");
    await ate(() => avaliar("document.querySelectorAll('#import-lista input[type=checkbox]').length===1"));
    verificar("filtro por projeto reduz a lista", true);
    await avaliar("{const c=document.querySelector('#import-lista input[type=checkbox]');c.checked=true;c.dispatchEvent(new Event('change'))}");
    await avaliar("document.getElementById('preview-dialog-confirmar').click()");
    await ate(() => ponteImp.estadoAtual().nos.some((n) => n.sessionID === "ses_b1"), 15000);
    verificar("importar cria nó vinculado sem duplicar", ponteImp.estadoAtual().nos.filter((n) => n.sessionID === "ses_b1").length === 1);
    await avaliar("document.getElementById('btn-acompanhar').click()");
    await ate(() => avaliar("document.querySelectorAll('#import-lista input[type=checkbox]').length>0"), 15000);
    verificar("vinculada não reaparece na lista", await avaliar("!document.querySelector('#import-lista input[data-sessao=\"ses_b1\"]')"));
    await ponteImp.parar();
    falsoImp.close();
  } else {
    for (const nome of ["diálogo lista não vinculadas com teto de 50", "filtro por projeto reduz a lista", "importar cria nó vinculado sem duplicar", "vinculada não reaparece na lista"]) verificar(nome, false);
  }

  // Fixture usa o renderizador real e gestos de mouse CDP; nenhum mutador de debug.
  await avaliar(`(async()=>{
    const {criarArvore}=await import('/ui/tree.js');
    const c=document.createElement('canvas');c.id='fixture';c.style.cssText='position:fixed;inset:0;width:900px;height:600px;z-index:100';document.body.append(c);
    const state={grupos:[],nos:[{id:'a',titulo:'Primeiro',papel:'lideranca',estado:'ativo'},{id:'b',titulo:'Segundo',papel:'execucao',estado:'dormente'}],dependencias:[{origem:'a',destino:'b'}],preferencias:{efeitos:'desligado'}};
    window.__fixture=criarArvore(c);window.__fixture.definirEstado(state,{});
  })()`);
  const foto = () => avaliar("({pos:window.__fixture._debugPosicoes(),camera:window.__fixture.camera()})");
  const antes = await foto();
  const a = antes.pos.find((p) => p.id === "a"); const b = antes.pos.find((p) => p.id === "b");
  const tela = (p) => ({ x: 450 + (p.x - antes.camera.x) * antes.camera.zoom, y: 300 + (p.y - antes.camera.y) * antes.camera.zoom });
  const at = tela(a); const bt = tela(b);
  await mouse("mouseMoved", at.x, at.y); await mouse("mousePressed", at.x, at.y, 1);
  await mouse("mouseMoved", bt.x, bt.y, 1);
  const agarrado = await foto();
  verificar("gesto de mouse arrasta nó, não a câmera", Math.abs(agarrado.pos.find((p) => p.id === "a").y - a.y) > 30 && agarrado.camera.alvoX === antes.camera.alvoX);
  await ate(async () => Math.hypot((await foto()).pos.find((p) => p.id === "b").x - b.x, (await foto()).pos.find((p) => p.id === "b").y - b.y) > 10);
  verificar("vizinho se afasta do nó agarrado no navegador", true);
  await mouse("mouseReleased", bt.x, bt.y);
  verificar("ao soltar o nó conserva o destino organizado", await ate(async () => { const p=(await foto()).pos.find((p)=>p.id==='a');return Math.hypot(p.x-b.x,p.y-b.y)<4; }));
  await mouse("mouseMoved", 30, 500); await mouse("mousePressed", 30, 500, 1); await mouse("mouseMoved", 90, 500, 1); await mouse("mouseReleased", 90, 500);
  verificar("arrastar fundo ainda move a câmera", (await foto()).camera.alvoX < antes.camera.alvoX - 30);
  await avaliar("document.getElementById('fixture').remove()");
  await avaliar("document.getElementById('btn-centralizar').click()");
  await avaliar("new Promise(r=>{let n=0;function quadro(){if(++n>=45)r();else requestAnimationFrame(quadro);}requestAnimationFrame(quadro);})");
  verificar("sem exceção JavaScript na página", erros.length === 0, erros.join("\n"));
  await cdp.enviar("Page.captureScreenshot", { format: "png" }).then((r) => fs.writeFileSync(path.join(execucao, "painel.png"), Buffer.from(r.data, "base64")));
  console.log(`\nCaptura simulada: ${path.relative(raiz, path.join(execucao, "painel.png"))}`);
  console.log(`Resultado: ${passou} ok, ${falhou} falhas.`);
  if (falhou) process.exitCode = 1;
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  if (cdp) { try { await cdp.enviar("Browser.close"); } catch {} cdp.fechar(); }
  if (browser && browser.exitCode == null) {
    // Apenas o processo/perfil criado pelo teste, nunca o navegador pessoal.
    if (process.platform === "win32") { try { execFileSync("taskkill", ["/PID", String(browser.pid), "/T", "/F"], { stdio: "ignore" }); } catch {} }
    else browser.kill("SIGTERM");
  }
  if (ponte) await ponte.parar();
}
