# Código do TreeOffice — protótipo (Etapa 2)

Nenhuma dependência externa, nenhum passo de build, nenhuma chamada ao OpenCode.
O protótipo roda com o Node instalado e serve todos os recursos localmente
(D25). Ele existe para provar aparência, animação, navegação, popup e
persistência com dados simulados — e para isso usa caminhos fictícios
(`/simulado/...`), nunca os projetos reais do usuário.

## Como executar

```powershell
node src\server\bridge.mjs
```

A ponte imprime um endereço com token, parecido com:

```text
Ponte   http://127.0.0.1:4717/?token=<64 caracteres hexadecimais>
```

Abra esse endereço no navegador. O token é exigido em todas as requisições
(D41); se a porta 4717 estiver ocupada, a ponte **não** troca de porta em
silêncio — ela informa e não inicia (D40). Para usar outra porta:
`node src\server\bridge.mjs --porta 4800`.

Para encerrar: `Ctrl+C`. O estado permanece em `.local/`.

## Como verificar

```powershell
node tests\smoke.mjs
```

O teste cria diretórios temporários descartáveis e exercita autenticação,
validação de origem, recursos locais, normalização do estado, simulação,
escrita atômica com backup, lock e modo degradado. Nada toca em projetos,
chats, worktrees, vault ou no OpenCode.

## Estrutura

```text
src/
├── shared/
│   ├── model.mjs      contrato de estado, normalização defensiva, ocupação
│   │                  de worktree e cálculo de profundidade
│   └── mock.mjs       árvore de demonstração e motor de simulação
├── server/
│   ├── bridge.mjs     ponte HTTP: token, origem, recursos estáticos, rotas
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

## Limites conhecidos do protótipo

- O desenho é Canvas 2D puro. p5.js continua sendo apenas candidata (D19): a
  escolha definitiva depende de você avaliar o resultado.
- A simulação é local e não representa o comportamento real das sessões.
- Nenhuma operação de escrita no OpenCode ou no Git existe aqui. Criar chat,
  vincular worktree e criar worktree pertencem às Etapas 4 e 5.
- O popup demonstra as confirmações; ele não chama API alguma.
