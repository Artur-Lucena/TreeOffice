# Código do TreeOffice — protótipo (Etapa 2)

Nenhuma dependência externa, nenhum passo de build, nenhuma chamada ao OpenCode.
O protótipo roda com o Node instalado e serve todos os recursos localmente
(D25). Ele existe para provar aparência, animação, navegação, popup e
persistência com dados simulados — e para isso usa caminhos fictícios
(`/simulado/...`), nunca os projetos reais do usuário.

## Requisitos

- **Node 18.2 ou mais recente** (20/22 LTS recomendado). A ponte usa `fetch`
  global, `??` e `server.closeAllConnections?.()`, indisponíveis antes do 18.2.
- Nenhuma dependência para instalar: só o runtime do Node.
- Funciona em Windows e Linux. Os comandos abaixo usam barras normais, que
  valem nos dois sistemas (no PowerShell do Windows, `node src\server\bridge.mjs`
  também funciona, mas a documentação padroniza `/`).

## Como executar

```bash
node src/server/bridge.mjs
```

```bash
node src/server/bridge.mjs --fonte real
TREEOFFICE_FONTE=real node src/server/bridge.mjs
```

A ponte imprime um endereço com token, parecido com:

```text
Ponte   http://127.0.0.1:4717/?token=<64 caracteres hexadecimais>
```

Abra esse endereço no navegador. O token é exigido em todas as requisições
(D41); se a porta 4717 estiver ocupada, a ponte **não** troca de porta em
silêncio — ela informa e não inicia (D40). Para usar outra porta:
`node src/server/bridge.mjs --porta 4800`.

Para encerrar: `Ctrl+C`. O estado permanece em `.local/`.

## Como verificar

```bash
node tests/smoke.mjs        # ponte, autenticação, persistência, lock…
node tests/tree-render.mjs  # renderizador: quem é desenhado e onde
node tests/opencode-client.mjs  # Fase B com serviço simulado (descoberta, paginação, SSE, modo real)
```

O smoke cria diretórios temporários descartáveis e exercita autenticação,
cookie de subrecursos, validação de origem, recursos locais, normalização do
estado, simulação, escrita atômica com backup, lock e modo degradado. Nada toca
em projetos, chats, worktrees, vault ou no OpenCode.

O `tree-render` instancia o `tree.js` de verdade com um DOM falso e observa as
chamadas de `arc`/`fillText` — é o que pega defeitos de renderização que o
smoke não alcança, como nós desenhados em NaN (invisíveis) ou nós sem âncora.

## Estrutura

```text
src/
├── shared/
│   ├── model.mjs      contrato de estado, normalização defensiva, ocupação
│   │                  de worktree e cálculo de profundidade
│   └── mock.mjs       árvore de demonstração e motor de simulação
├── server/
│   ├── bridge.mjs     ponte HTTP: token, origem, recursos estáticos, rotas
│   ├── opencode-client.mjs  Fase B: descoberta e cliente HTTP somente leitura
│   └── state-store.mjs  carga, escrita atômica, backup e lock de .local/
└── ui/
    ├── index.html     página única
    ├── styles.css     estilo local, sem fontes externas
    ├── tree.js        renderização orgânica em Canvas 2D
    └── app.js         estado, API, painel e fluxo do popup
```

## O que o protótipo já demonstra

- Árvore orgânica e animada, com grupos, nós e arestas de dependência em
  camadas visualmente distintas (D15).
- Onda 1 de efeitos (Canvas 2D puro, D45): deriva orgânica por soma
  quase-periódica (ativo respira, dormente quase para), hover que realça a
  vizinhança e esmaece o resto, fluxo animado nas dependências com seta de
  direção, poeira ambiente e vinheta. Densidade em `preferencias.efeitos`
  (`cheio`, `sutil` ou `desligado`), com `prefers-reduced-motion` respeitado.
- Estados: ativo, dormente, sem sessão, não encontrado e incerto. Chat parado
  permanece visível; ausência de dado não é desenhada como estado (D16).
- Navegação: arrastar, zoom na roda, clique para selecionar, duplo clique para
  focar, recolher galho, centralizar.
- Popup de criação em quatro etapas, com a pergunta sobre worktree, aviso de
  conflito de ocupação e a declaração de que a operação pode executar a
  preparação do projeto (D03, D27, D30).
- Persistência da estrutura em `.local/state.json`, com escrita atômica,
  backup e lock (D20, D22).
- Ponte apenas em `127.0.0.1`, com token de 256 bits, validação de `Origin` e
  `Host` nas escritas, e recursos sem rede externa (D40, D41, D25).
- Cookie HttpOnly `treeoffice_token`, gravado na primeira requisição
  autenticada para que o navegador carregue CSS e JS sem o `?token=` na URL —
  sem ele a página abria com "tela em branco com botões". O cookie não se
  renova sozinho e as escritas continuam validando `Origin` e `Host` (D41).

## Limites conhecidos do protótipo

- O desenho é Canvas 2D puro e assim fica: a p5.js foi descartada por D45
  depois que a avaliação visual aprovou o resultado.
- A simulação é local e não representa o comportamento real das sessões.
- Nenhuma operação de escrita no OpenCode ou no Git existe aqui. Criar chat,
  vincular worktree e criar worktree pertencem às Etapas 4 e 5 do roadmap.
- O popup demonstra as confirmações; ele não chama API alguma.

## Fase B — dados reais somente leitura

A ponte nasce em simulado. Para ler o serviço OpenCode já em execução
(sem iniciá-lo, sem criar nada lá fora):

- Na interface: botão "Usar dados reais" alterna a fonte; "Ressincronizar"
  refaz a leitura completa (D33). O mock continua disponível para teste.
- Por linha de comando: `--fonte real`, `--opencode-url URL`,
  `TREEOFFICE_FONTE=real`, `OPENCODE_SERVER_URL=URL`.
- Descoberta: `$XDG_STATE_HOME/opencode/service.json`,
  `~/.local/state/opencode/service.json` (ou equivalente no Windows) e
  senha de `~/.config/opencode/service.json`. A credencial vive só na
  memória da ponte; nunca vai ao navegador, ao `.local/` ou aos logs.

Rotas novas (todas com o token da ponte; POST também valida Origin/Host):

- `GET /api/opencode/estado` — modo, conexão, versão, contagens, erro.
- `GET /api/opencode/sessoes?limit&cursor&...` — página de sessões.
- `GET /api/opencode/projetos` — projetos.
- `GET /api/opencode/worktrees?projectID=...` — worktrees do projeto.
- `POST /api/opencode/ressincronizar` — releitura completa.
- `POST /api/opencode/modo {"modo":"real"|"simulado"}` — alterna a fonte.

`/api/vivo` passa a mapear nós com `sessionID` pelo inventário + SSE
quando em modo real; sessão ausente vira `nao_encontrado` (D21),
inventário velho ou com erro vira `incerto` (D32). Eventos servem só para
vivacidade: queda e reconexão recompõem por releitura, sem apagar nós.
Em modo real há releitura periódica (60 s) para o inventário não
envelhecer, re-assinatura do SSE após a leitura voltar a funcionar e
re-descoberta do serviço (o serviço pode reiniciar em outra porta).
