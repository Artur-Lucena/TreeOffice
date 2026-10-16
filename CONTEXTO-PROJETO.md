# TreeOffice — contexto do projeto

## 1. Objetivo e localização

Criar uma integração visual com o OpenCode para ver, organizar e criar chats
conectados em uma árvore orgânica, dinâmica e animada, semelhante ao Blob Office.

O painel deverá ajudar o usuário a acompanhar conversas, responsabilidades,
worktrees, evidências e dependências sem interferir nos projetos atuais.

Pasta-mãe do projeto: **a pasta onde este repositório foi clonado**. O painel
não depende de caminho absoluto fixo (D43). Originalmente, no Windows, a pasta
era `D:\Meus Projetos\TreeOffice`; em 12/10/2026 o usuário passou a trabalhar
também no Linux, com o repositório clonado em
`/run/media/tuco/Games/Meus Projetos/TreeOffice`.

Todo o código, documentação, recursos e testes do TreeOffice devem permanecer
na pasta do repositório. Projetos externos exibidos pelo painel continuam onde
já estão.

## 2. Estado atual

**Atualização em 16/10/2026:** F4 com causa raiz encontrada e corrigida (`49aa629`): `await` fora de async parava o módulo inteiro (tela preta com "conectando…"), `indicador` do explorador restaurado, renomear em escopo de módulo com diálogo temático, HTML corrigido, `iniciar.mjs` encerra em porta ocupada. `.local/` limpo de mock — só os 2 nós reais importados (D63: painel nasce vazio; semeio demo só opt-in em `smoke`/`browser-ui`). Gate ESM em `scripts/checar-sintaxe-ui.mjs` (D64). **261 verificações verdes** (`browser-ui` com 36). Hosts zumbis encerrados; ponte real na 4717. Falta só a validação manual do usuário (F4).

**Atualização em 15/10/2026:** Fases C (D58) e D (D59) implementadas e validadas ao vivo em `area-testes/demo`; Fase E (D60) implementada — leitura selecionada do Tucofre como sugestão de instruções e remoção explícita de dependências; Fase F (D61) autorizada e em validação assistida. 231 verificações verdes. Os parágrafos abaixo preservam o histórico inicial. D54–D57 registram tipografia local, naipes centrais, posições livres persistidas, fios uniformes e selecionáveis, ramificações nos fios e diálogos animados/arrastáveis. Foi autorizado aplicar e enviar essas mudanças ao repositório. A integração com OpenCode permanece somente leitura; criação de módulos continua visual/simulada. Detalhes e testes em `docs/UI-REFORMULADA-2026-10-14.md`.

**Atualização em 13/10/2026:** a ponte somente leitura está implementada;
continua faltando UI para vincular sessões reais (Fase C não autorizada).
Os defeitos de arrasto, colisão e naipes foram reunidos para correção a pedido
do usuário. O registro e as verificações desta entrega estão em
`docs/CORRECOES-UI.md`; D51/D52 registram o escopo. A árvore pessoal não é
substituída por dados de demonstração durante testes. Os parágrafos abaixo
preservam o histórico inicial.

A estrutura, a documentação e o protótipo visual foram construídos. O roadmap
da V1 foi aprovado como base, a Etapa 2 foi concluída e a Fase B (integração
somente leitura) foi autorizada. O painel ainda usa dados simulados; o cliente
HTTP de integração com o OpenCode ainda não foi implementado.

A Rodada 1 do fechamento foi concluída: D12 (aplicação local independente com
ponte local), D13 (a conversa continua na interface do OpenCode na V1) e D14
(cadastro explícito de pastas e projetos). A Rodada 2 também foi fechada, com
D17 (papel como metadado visual), D18 (grupo com ou sem diretório cadastrado) e
D19 (p5.js como candidata de renderização). A Rodada 3, sobre persistência dos vínculos, também foi fechada, com D20
(arquivo JSON em `.local/` versionado), D21 (identidade própria do painel),
D22 (escrita atômica, backup e lock) e D23 (nada de conteúdo privado no estado
local). A Rodada 4, sobre worktrees, foi fechada com D26 a D30: vincular
existente antes de criar novo, aviso bloqueante para worktree compartilhado,
origem e destino definidos pelo projeto, e alterações não commitadas apenas
detectadas e exibidas. As Rodadas 5 e 6 fecharam recuperação de falhas,
anti-duplicação e participação futura do Tucofre (D31 a D39).
A Rodada 7, sobre instalação e fechamento, foi fechada com D40 (porta 4717
apenas em `127.0.0.1`), D41 (token de 256 bits em `.local/`, com validação de
`Origin` e `Host` nas escritas) e D42 (início, parada, atualização e
desativação sem registro global). O plano consolidado está em
`docs/PLANO-CONSOLIDADO.md`. A pesquisa de referência e ecossistema foi
concluída e registrada em `docs/PESQUISA.md`, com as decisões D24 e D25.

O usuário autorizou publicar o trabalho no repositório
`https://github.com/Artur-Lucena/TreeOffice`. O protótipo não tem dependências
externas; o runtime Node foi instalado pelo usuário no Linux. As operações
de criação avaliadas no painel foram simuladas. Nenhum chat ou worktree real,
configuração global do OpenCode ou projeto externo foi alterado pelo TreeOffice.

Também em 12/10/2026, no mesmo dia: o protótipo da Etapa 2 foi construído em
`src/` (Node puro, sem dependências, sem build) e verificado por teste
automatizado (`node tests/smoke.mjs`, 38 verificações na época). Uma correção
posterior — cookie HttpOnly `treeoffice_token` para o navegador carregar
subrecursos sem o `?token=` na URL — elevou a verificação para 44 itens. Em
12/10/2026, já no Linux com Node v22.22.1, o teste rodou completo:
**44 ok, 0 falhas, saída limpa** (D44 satisfeito).

O usuário passou a usar o projeto no Linux pela primeira vez em 12/10/2026. O
código do protótipo é portátil (usa `node:path` e aceita `/` e `\` nos caminhos
que trata); a adaptação registrada em D43 cobriu documentação, caminhos e
comandos. O ambiente Linux tem o serviço OpenCode instalado
(`~/.opencode/bin/opencode`, versão v2.0.15), e o Node foi instalado no mesmo
dia (v22.22.1).

Na primeira avaliação visual, o usuário aprovou a aparência, mas criar um chat
não aparecia na tela. A causa foram três defeitos de renderização no
`src/ui/tree.js`, encontrados por teste com DOM falso e corrigidos no mesmo
dia: posições nascidas sem velocidade/fase (coordenadas NaN, que tornavam a
árvore inteira invisível), nós sem grupo de origem sem âncora própria, e
subárvore de galho recolhido que continuava desenhada. O teste
`tests/tree-render.mjs` cobre os três casos e os efeitos da Onda 1
(21 verificações); `tests/smoke.mjs` segue com 44 verificações verdes no
Linux. A Fase B é coberta por `tests/opencode-client.mjs` (27 verificações
com serviço simulado).

No reteste (12/10/2026) o usuário aprovou: árvore visível, criação, vinculação
e remoção de vínculo funcionando. A D19 foi encerrada por D45 — p5.js
descartada, renderização segue em Canvas 2D puro, sem dependência externa.

Ainda em 12/10/2026, com autorização do usuário (Fase B do roadmap), a ponte
teve seu contrato com o serviço local comprovado por chamadas somente
leitura: serviço em `http://127.0.0.1:49374` (OpenCode v2.0.15),
`session.list` com paginação por cursor, eventos por SSE e worktrees por
`projectID` — registro em `docs/PESQUISA.md` §8 e decisão D46 (HTTP com
`fetch` do Node, sem dependência nova). Nenhuma credencial, id, título ou
diretório real foi registrado (D23).

Em 12/10/2026 o repositório Git local foi inicializado nesta pasta, rastreando
`origin/main`, e o histórico remoto foi adotado sem reescrita. A identidade de
commit local usa o endereço `noreply` da conta GitHub. O estado de execução do
painel, quando existir, fica em `.local/`, fora do versionamento.

O usuário retomou o planejamento em 12/10/2026, agora no Linux, e aprovou o
roadmap de execução da V1 em fases A–F, registrado em
[docs/ROADMAP-V1.md](docs/ROADMAP-V1.md). A Fase A está concluída e a Fase B
(integração somente leitura com o OpenCode) foi autorizada. As Fases C a F
dependem de autorização própria; a leitura do Tucofre exige nova decisão.

## 3. Referência existente inspecionada

Foram lidos os arquivos (no Windows; o padrão equivalente no Linux seria
`~/.config/opencode/plugins/`, onde a referência não está instalada):

- `C:\Users\Tuco\.config\opencode\plugins\blob-office.html`.
- `C:\Users\Tuco\.config\opencode\plugins\blob-office.ts`.
- `C:\Users\Tuco\.config\opencode\plugins\blob-office-INSTALL-NOTES.md`.

O Blob Office utiliza p5.js e um WebSocket em `ws://localhost:2727/ws` para
representar a atividade de sessões com blobs animados.

Ele é um visualizador passivo: não oferece controles para criar chats ou
gerenciar worktrees. Seu estado visual é temporário e certos agentes são
removidos da visualização após inatividade.

O TreeOffice funciona separadamente. Em 13/10/2026 o usuário ordenou a
remoção do Blob Office da pasta global de plugins (D47); os 4 arquivos foram
movidos para pasta de backup fora de `plugins/`, sem cópia para este
repositório. Não foi copiado código do Blob Office para o projeto.

A versão consultada pelo comando `opencode.cmd --version` foi `v2.0.26`
(Windows). Na instalação Linux de 12/10/2026, `opencode --version` retorna
`v2.0.15` (binário em `~/.opencode/bin/opencode`). A documentação pública V2
oferece operações para sessões e worktrees. A inspeção do contrato e as
chamadas de leitura realizadas em 12/10/2026 estão em `docs/PESQUISA.md` §8;
o status e as limitações das verificações V01 a V06 estão no §7.

## 4. Aparência e interação confirmadas

- Árvore orgânica e animada, não um diagrama estático de caixas.
- Linguagem visual semelhante ao Blob Office.
- Cada chat é um blob associado a um galho.
- Ao criar uma ramificação, o novo galho aparece com animação.
- O movimento e a aparência dos blobs refletem o estado de atividade.
- Chats parados ou concluídos permanecem visíveis.

Zoom, arrastar a árvore, recolher ramificações e transições fazem parte do
protótipo aprovado pelo usuário. Canvas 2D puro foi confirmado por D45.

## 5. Novos chats: decisão mais recente

**Todos os novos chats começam novos, sem histórico herdado.**

A proposta inicial de copiar a conversa de origem foi substituída por essa
decisão. A relação entre galhos é organizacional e visual, não uma ordem para
usar o endpoint de fork nem para compartilhar contexto continuamente.

O novo chat pode receber instruções de entrada e uma tarefa explicitamente
selecionadas. Não copiar a conversa de outro chat nem inserir conteúdo do
Tucofre automaticamente.

Uma pasta, um papel organizacional ou um nó sem sessão não inicia um chat.
Criação e abertura de chats exigem ação explícita do usuário.

## 6. Popup e isolamento por worktree

Ao criar uma ramificação, abrir um pequeno popup perguntando se o usuário
deseja criar um worktree.

Fluxo proposto:

1. Selecionar o nó de origem e solicitar um novo chat.
2. Informar título/tarefa e, se desejado, instruções de entrada.
3. Responder à pergunta sobre o novo worktree.
4. Se não criar, escolher uma pasta/worktree existente.
5. Se criar, conferir repositório, referência de origem, nome e destino.
6. Confirmar explicitamente a operação.
7. Criar uma sessão nova no contexto escolhido e registrar o vínculo visual.

Subassistentes que alteram código precisam de branches e worktrees próprios.
Pode-se vincular um worktree exclusivo já existente em vez de criar outro.
O compartilhamento foi definido por D27: aviso bloqueante, confirmação
explícita e registro no estado local.

Criar um chat não isola arquivos. Criar um worktree não copia o histórico de
conversa. Essas operações devem permanecer distintas, mesmo quando a interface
as apresenta em um único fluxo.

## 7. Organização atual do usuário

O usuário apresentou esta hierarquia apenas como exemplo:

```text
GameDev/
├── assistente/                 # liderança e revisão do roadmap
│   └── sub-assistentes/
│       ├── sub-assistente-1/    # tarefas menores
│       └── sub-assistente-2/    # tarefas menores
├── ferramentas_estudo/         # investigação e execução pesada
└── estudos_indie/              # permanece como está
```

**Não procurar GameDev, exigir seu caminho ou criar essa hierarquia.**

A intenção é adaptar o TreeOffice a organizações semelhantes já existentes,
sem mover ou renomear pastas e sem pressupor que pertencem a um único Git.

Separar:

- Hierarquia organizacional: liderança, subassistentes e áreas de trabalho.
- Contexto de execução: chat, diretório, repositório, branch e worktree.
- Dependências do roadmap: tarefas que precisam de entregas de outras tarefas.

A árvore visual não deve exigir alteração das relações nativas entre sessões.
Conexões pontilhadas para dependências foram definidas por D38 e demonstradas
no protótipo: são criadas e removidas apenas por ação explícita do usuário.

## 8. Tucofre e responsabilidades humanas

Tucofre é o vault do Obsidian do usuário. Responsabilidades, entregas, evidências,
dependências e instruções de entrada dos chats são registradas ali.

O usuário continua distribuindo tarefas, conferindo evidências e acompanhando
as dependências. A integração não deve delegar tarefas ou iniciar agentes
automaticamente.

Proposta inicial para a integração:

- Tratar os registros do Tucofre como fonte de verdade dessas informações.
- Começar com leitura de conteúdo explicitamente selecionado.
- Não manter um segundo roadmap concorrente.
- Não escrever, indexar todo o vault ou sincronizar registros automaticamente.
- Manter a documentação do próprio TreeOffice na pasta-mãe do projeto.

O caminho e o formato dos registros do vault não foram informados. Só devem
ser solicitados quando forem necessários para uma etapa aprovada.

## 9. Direção técnica atual

- Painel web local separado do Blob Office.
- p5.js como candidato para preservar a linguagem visual da referência.
  Descartada por D45: o Canvas 2D puro do protótipo entregou a linguagem
  visual aprovada pelo usuário, sem dependência externa.
- Integração com o serviço OpenCode usando a API V2.
- Ponte local para manter credenciais fora do navegador.
- Persistência própria de vínculos e preferências visuais.
- Leitura de sessões existentes antes de habilitar operações de escrita.
- Recuperação do estado após desconexões, sem depender apenas de eventos.
- Credenciais, histórico e caminhos tratados como dados privados.

D12 fixou aplicação local independente com ponte local como base; plugin V2
fica fora da arquitetura inicial. O protótipo usa Node e JavaScript sem
framework, build ou dependências externas. D40 definiu a porta padrão 4717
apenas em `127.0.0.1`; D46 definiu HTTP com `fetch` do Node para a integração.

Um painel lateral para ler e conversar nos chats foi proposto. D13 adiou essa
ideia: na V1 a conversa acontece na interface do OpenCode.

## 10. Proteções e limites

- Não reorganizar projetos existentes.
- Não modificar o Blob Office ou reutilizar sua porta sem acordo explícito.
- Não alterar agentes, modelos ou permissões de chats existentes.
- Não executar commit, stash, reset, merge ou troca de branch implicitamente.
- Não copiar ou descartar alterações não commitadas silenciosamente.
- Não excluir chat, branch ou worktree ao remover um vínculo visual.
- Não instalar dependências dentro dos projetos acompanhados.
- Conferir scripts de preparação antes de criar worktrees pela API.
- Não alterar configuração global nem iniciar serviços como teste automático.
- Não executar operações de escrita sem ação explícita do usuário.

Se a instalação exigir configuração global do OpenCode, apresentar a mudança
para aprovação e apontar para o código dentro do TreeOffice, sem espalhar cópias.

## 11. Ponto de parada — 12/10/2026

O usuário pediu para salvar o trabalho e encerrar por hoje. Retomar somente
quando ele solicitar.

- **Fase A concluída:** Linux com Node v22.22.1; protótipo aprovado no reteste;
  Canvas 2D puro confirmado (D45).
- **Últimas verificações realizadas:** `node tests/smoke.mjs` com 44 ok e
  0 falhas; `node tests/tree-render.mjs` com 11 ok e 0 falhas. São testes
  simulados, não testes da integração implementada.
- **Fase B autorizada e parcial:** contrato inspecionado via CLI e escolha de
  cliente definida (D46). A ponte ainda não consulta o OpenCode e a árvore
  ainda não usa sessões reais.
- **Próxima entrega:** consultar a documentação V2 atual de API e cliente,
  confirmar descoberta e autenticação sem iniciar serviço automaticamente,
  implementar o cliente HTTP somente leitura e testar primeiro com serviço
  simulado. Depois ligar inventário paginado, estados e reconexão à árvore.
- **Pendências:** completar V01/V04 conforme as limitações em
  `docs/PESQUISA.md` §7, pesquisar V05 e executar B3 a B5. V02, V03 e V06
  pertencem às próximas fases.
- **Estado local:** a árvore e seus backups ficam em `.local/`, fora do Git;
  credenciais e conteúdo privado não entram na documentação ou nos commits.
- **Autorizações:** Fase B somente leitura; Fases C a F ainda exigem aprovação
  própria. Nenhuma criação real foi autorizada nesta rodada.

O endereço do serviço observado nesta sessão é uma informação de diagnóstico,
não uma porta fixa de integração. Descoberta e compatibilidade devem ser
conferidas na retomada. A execução segue
[docs/ROADMAP-V1.md](docs/ROADMAP-V1.md).

Documentos complementares:

- [Decisões](docs/DECISOES.md).
- [Planejamento](docs/PLANEJAMENTO.md).
- [Segurança](docs/SEGURANCA.md).
- [Plano consolidado](docs/PLANO-CONSOLIDADO.md).
- [Roadmap da V1](docs/ROADMAP-V1.md).

## 12. Referências técnicas

- [Plugins V2](https://opencode.ai/v2/docs/build/plugins).
- [Cliente V2](https://opencode.ai/v2/docs/build/client).
- [API V2](https://opencode.ai/v2/docs/api).
- [OpenAPI público V2](https://opencode.ai/v2/openapi.json).
- [Instruções e AGENTS.md](https://opencode.ai/v2/docs/instructions).

Reconsultar a documentação e verificar a instalação na etapa apropriada;
essas referências não substituem validação de compatibilidade local.
