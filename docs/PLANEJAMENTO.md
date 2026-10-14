# Planejamento — estado em 12/10/2026

**Atualização da UI em 13/10/2026:** D51/D52 e
[CORRECOES-UI](CORRECOES-UI.md) registram arrasto, contato independente do
zoom, vivacidade e escolha de papel/naipe. Foram acrescentados testes em
navegador real com dados descartáveis. Isso não autoriza a Fase C nem muda
os limites de escrita externa. As contagens históricas abaixo correspondem
às verificações anteriores.

**Estado em 12/10/2026:** protótipo da Etapa 2 concluído e aprovado no reteste;
adaptação ao Linux concluída; D45 e D46 registradas. Fase B autorizada e em
andamento, com pesquisa inicial do contrato feita e cliente HTTP ainda por
implementar. Trabalho pausado a pedido do usuário; ponto de retomada em
`CONTEXTO-PROJETO.md` §11. O roadmap está em [ROADMAP-V1](ROADMAP-V1.md);
Fases C a F dependem de autorização própria (D11).

Este documento organiza a próxima conversa. As etapas abaixo são propostas,
não autorização para executá-las.

## 1. Decisões bloqueadoras

A ordem abaixo segue as dependências, não a ordem em que os temas foram
surgindo. Cada rodada só é iniciada quando a anterior deixa de bloquear.

### Rodada 1 — arquitetura e escopo (fechada em 12/10/2026)

- [x] Escolher arquitetura: plugin V2, aplicação independente ou combinação.
  Resolvido por D12: aplicação local independente com ponte local.
- [x] Fechar o escopo: conversar no painel ou abrir o chat no OpenCode.
  Resolvido por D13: a conversa continua na interface do OpenCode na V1.

### Rodada 2 — organização e aparência (fechada em 12/10/2026)

- [x] Definir como organizar projetos, papéis e sessões sem reorganizar pastas.
  Resolvido por D14, D17 e D18: cadastro explícito, papel como metadado visual
  sem comportamento, grupo com ou sem diretório cadastrado.
- [x] Definir os elementos visuais, estados e navegação da árvore animada.
  Direção aprovada em D15 e D16. O desenho detalhado — formato dos blobs,
  galhos, agrupamento, zoom e transições — sai do protótipo da Etapa 2, com
  dados simulados, e volta para aprovação.
- [x] Confirmar a biblioteca de renderização.
  Resolvido por D19 e encerrado por D45: p5.js descartada; Canvas 2D puro
  provou árvore orgânica, animada e estável, aprovado no reteste.

### Rodada 3 — persistência (fechada em 12/10/2026)

- [x] Definir persistência dos vínculos sem alterar sessões existentes.
  Resolvido por D20 a D23: arquivo JSON em `.local/` com `schemaVersion`,
  identidade própria do painel com `sessionID` como referência opcional,
  escrita atômica com backup e lock, e proibição de conteúdo privado no
  estado local.
  A parte de falhas parciais que depende das operações do OpenCode, e não do
  disco, permanece na Rodada 5.

### Rodada 4 — worktrees (fechada em 12/10/2026)

- [x] Definir vinculação a worktree existente e exclusividade de subassistentes.
  Resolvido por D26 e D27: vincular existente antes de criar novo, e aviso
  bloqueante com confirmação explícita quando dois nós de implementação
  disputam o mesmo worktree.
- [x] Definir origem, nomes, destinos e confirmações para novos worktrees.
  Resolvido por D28 e D30: origem escolhida no popup, nome sugerido e editável,
  destino definido pelo projeto, e popup que declara a possível execução da
  preparação do projeto.
- [x] Definir comportamento diante de alterações não commitadas e scripts de setup.
  Resolvido por D29: detectar, exibir e explicar que não migram; o painel nunca
  faz commit, stash, reset, merge ou cópia de arquivos.

### Rodada 5 — resiliência (fechada em 12/10/2026)

- [x] Definir falhas parciais, recuperação e prevenção de criação duplicada.
  Resolvido por D31 a D34: sem limpeza destrutiva automática, estado incerto
  como estado explícito, reconexão por releitura e anti-duplicação por
  confirmação. D35 mantém a resposta a permissões fora do escopo da V1.
  A parte de persistência em disco já havia sido fechada na Rodada 3 (D22).

### Rodada 6 — Tucofre e dependências (fechada em 12/10/2026)

- [x] Definir a participação inicial do Tucofre e o formato mínimo dos registros.
  Resolvido por D36 e D39: a V1 não lê o vault e nenhum caminho é pedido agora.
  D37 define o formato mínimo futuro: seleção explícita de um arquivo, lido
  como texto, apresentado como instruções sugeridas. D38 trata das dependências.

### Rodada 7 — instalação e fechamento (fechada em 12/10/2026)

- [x] Definir autenticação local, instalação, configuração e verificação.
  Resolvido por D40, D41 e D42: porta 4717 apenas em `127.0.0.1`, token de
  256 bits em `.local/` exigido em toda requisição, validação de `Origin` e
  `Host` nas escritas, e ciclo de início, parada, atualização e desativação
  documentado sem registro global.
- [x] Apresentar o plano consolidado e obter aprovação antes da implementação.
  O plano está em [PLANO-CONSOLIDADO](PLANO-CONSOLIDADO.md) e o roadmap foi
  aprovado como base. O protótipo foi aprovado e a Fase B foi autorizada;
  as fases seguintes dependem de aprovação própria (D11).

Só solicitar caminhos de projetos externos ou do vault quando forem necessários
para uma etapa aprovada. Não inspecionar GameDev com base no exemplo anterior.

## 2. Etapas candidatas

### Etapa 0 — documentação e entrada do assistente

Estrutura, contexto, decisões, instruções e limites documentados.
Essa foi a etapa inicialmente autorizada. As autorizações posteriores estão
registradas nas decisões e no roadmap.

### Etapa 1 — fechamento do plano

Resolver as questões bloqueadoras e produzir um desenho de interface, contrato
de dados, arquitetura e critérios de aceite. Não instalar dependências nem
executar operações no serviço ou nos projetos reais para antecipar essa etapa.
As sete rodadas iniciais foram fechadas; adaptações ao Linux e encerramento do
protótipo foram registrados nas Rodadas 8 e 9. A correspondência com o roadmap
está em [ROADMAP-V1](ROADMAP-V1.md): Etapa 2→Fase A, Etapa 3→Fase B,
Etapa 4→Fase C, Etapa 5→Fase D, Etapa 6→Fase E, Etapa 7→Fase F.

### Etapa 2 — protótipo visual com dados simulados (concluída em 12/10/2026)

Construído em 12/10/2026 com Node puro, sem dependências, sem build e sem
qualquer acesso ao OpenCode, a projetos ou ao vault. Instruções de execução e
verificação em [src/README.md](../src/README.md).

Verificado por teste automatizado (`node tests/smoke.mjs`, 44 verificações),
com execução completa no Linux em 12/10/2026 sob Node v22.22.1: **44 ok,
0 falhas**:

- Autenticação por token em todas as requisições, com recusa de token
  inválido, ausente ou enviado apenas por query em escrita.
- Cookie HttpOnly `treeoffice_token`, gravado na primeira requisição
  autenticada, aceito em GET e POST, sem renovação quando a requisição só
  apresenta cookie, e com origem estranha ainda recusada (403).
- Validação de `Origin` e `Host` nas escritas, testada também por socket cru,
  porque o cliente HTTP do Node não permite forjar `Host`.
- Recursos servidos localmente, com bloqueio de fuga de diretório.
- Normalização defensiva do estado: nó sem identificador e aresta órfã são
  descartados com aviso, e conteúdo privado não é persistido.
- Escrita atômica com backup da versão anterior, sem arquivo temporário
  residual, com lock fresco bloqueando escrita e lock velho sendo assumido.
- Modo degradado: arquivo corrompido recai no backup sem apagar a árvore.
- Porta ocupada impede início silencioso.

Etapa 2 concluída em 12/10/2026. Na primeira avaliação visual o usuário
aprovou a aparência e o fundo, mas relatou que criar um chat não aparecia na
tela. A investigação encontrou três defeitos de renderização, todos corrigidos
e cobertos pelo teste `tests/tree-render.mjs` (21 verificações, incluindo os
efeitos da Onda 1): nós desenhados
em coordenadas NaN (a árvore inteira era invisível no canvas), nós sem grupo de
origem sem âncora própria, e subárvore de galho recolhido que continuava
desenhada.

No reteste o usuário aprovou: árvore visível, criação, vinculação e remoção de
vínculo funcionando. A D19 foi encerrada por D45 — p5.js descartada,
renderização segue em Canvas 2D puro. Nada foi testado contra uma instalação
real do OpenCode nesta etapa; o smoke roda no Linux com 44 verificações
verdes.

### Etapa 3 — integração somente leitura

Validar o contrato V2 da instalação autorizada, conexão com serviço já existente,
listagem de sessões, diretórios e worktrees, estados ao vivo e reconexão.
Caso seja necessário iniciar um serviço, solicitar autorização antes.

Pesquisa inicial realizada por chamadas somente leitura via CLI e inspeção do
OpenAPI local, registrada em [PESQUISA](PESQUISA.md) §§7–8. A implementação do
cliente HTTP, ligação com a árvore e recuperação de conexão continuam
pendentes. A autorização atual cobre apenas esta fase de leitura.

### Etapa 4 — ações explícitas de criação

Criar chats novos e permitir vinculação a worktree existente. Depois, validar
criação de novos worktrees, confirmações e recuperação de falhas.

Testar primeiro em repositórios descartáveis controlados pelo projeto.

### Etapa 5 — Tucofre e dependências

Integrar leitura selecionada de tarefas, instruções e evidências no formato
aprovado. Não criar sincronização automática ou um segundo roadmap.

### Etapa 6 — instalação e validação assistida

Documentar execução, dados locais, logs, atualização e desativação. Revisar
qualquer registro global antes de aplicá-lo. Validar com o usuário sem alterar
seus projetos como efeito colateral.

## 3. Critérios de aceite candidatos

Cobertura atual dos testes simulados: o smoke (`tests/smoke.mjs`, 44 ok)
cobre token/origem/host, cookie de subrecursos, recursos locais, normalização
sem conteúdo privado, escrita atômica com backup, lock, modo degradado e porta
fixa; o `tree-render` (55 ok) cobre nós visíveis, órfãos com âncora, galho
recolhido, efeitos da Onda 1, naipes por papel, colisão entre corpos, arrasto
com retorno suave, galhos em tubo e tipografia; o `opencode-client` (27 ok) cobre descoberta,
paginação, SSE, modo real e ausência de vazamento de credencial, tudo contra
serviço simulado.
**Atualização em 14/10/2026 (Fase C, D58):** smoke 51 ok; opencode-client 31 ok (inclui criarSessao); novo opencode-escrita 13 ok (ponte cria sessões com auth, idempotência inclusive concorrente, e pane sem vazar credencial, contra serviço falso); total do projeto 207 verificações. Validação contra serviço real pendente.
O restante segue pendente de integração real e de validação assistida.

- [ ] Árvore visualmente orgânica e animada, coerente com a referência.
- [ ] Nó de chat informa título, estado e contexto de trabalho correto.
- [ ] Chat parado não desaparece nem perde sua posição sem motivo.
- [ ] Atualizações não provocam saltos desnecessários na árvore.
- [ ] Abrir o painel não cria chats, worktrees ou tarefas.
- [ ] Criar galho apresenta a pergunta sobre worktree.
- [ ] Cancelar o fluxo não dispara operações de criação.
- [ ] Novo chat não recebe histórico de outro chat.
- [ ] Instruções e tarefa são inseridas somente quando escolhidas explicitamente.
- [ ] Projetos e repositórios diferentes não são confundidos.
- [ ] Worktree existente pode ser vinculado sem mudar sua branch.
- [ ] Conflitos de uso do mesmo worktree não ficam ocultos.
- [ ] Criação não dispara scripts ou alterações em arquivos silenciosamente.
- [ ] Falha parcial não apaga recursos existentes nem dispara tentativas duplicadas.
- [ ] Remover vínculo visual não remove sessão, branch ou worktree.
- [ ] Painel não altera configuração global do OpenCode.
- [ ] Painel não varre o disco em busca de pastas ou do vault.
- [ ] Na V1, conversar acontece na interface do OpenCode, não no painel.
- [ ] Painel funciona sem internet, com a biblioteca de renderização servida localmente.
- [ ] Estado local não contém conteúdo de conversa, notas do vault, credenciais ou tokens.
- [ ] Sessão ou caminho que deixou de existir aparece como "não encontrado", não desaparece.
- [ ] Queda do painel ou do serviço não apaga nem corrompe a árvore salva.
- [ ] Worktree compartilhado exige confirmação explícita e fica registrado.
- [ ] Painel nunca executa commit, stash, reset, merge nem cópia de arquivos entre diretórios.
- [ ] Nova branch não nasce de uma referência escolhida em silêncio.
- [ ] Popup de criação informa que a preparação do projeto pode ser executada.
- [ ] Falha no meio de um fluxo é relatada, sem remoção automática do que foi criado.
- [ ] Estado incerto leva a verificar, nunca a presumir ou repetir sozinho.
- [ ] Nenhum nó desaparece porque um evento foi perdido.
- [ ] Sessão aguardando permissão é exibida e aberta no OpenCode, não respondida pelo painel.
- [ ] O painel não abre nem lê o vault na V1.
- [ ] Instruções de entrada são sempre digitadas, nunca retiradas de outro chat.
- [ ] Aresta de dependência só existe por criação explícita; nenhum nó é bloqueado por dependência.
- [ ] Ponte escuta apenas em `127.0.0.1`, exige token em toda requisição e valida `Origin` e `Host` nas escritas.
- [ ] Credenciais do serviço OpenCode não aparecem no navegador, no estado local nem no repositório.
- [ ] Reconexão recompõe o estado atual sem depender de eventos perdidos.
- [ ] Credenciais e conteúdo privado não aparecem no cliente ou em logs indevidos.
- [ ] Blob Office, vault e projetos anteriores permanecem inalterados.

## 4. Limites do primeiro escopo

Não foram solicitados merge automático, commits, execução autônoma de tarefas,
remoção de worktrees, sincronização de conversas ou migração de projetos.

Recursos adicionais exigem discussão e autorização próprias; não devem entrar
na implementação apenas por serem tecnicamente possíveis.
