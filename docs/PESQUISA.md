# Pesquisa — referência, ecossistema e lições

**Data:** 12 de outubro de 2026.
**Natureza:** validação documental e leitura de código de terceiros.
**Não foi feito:** nenhum teste contra a instalação local do OpenCode, nenhum
serviço iniciado, nenhum chat ou worktree criado, nenhum projeto externo
alterado. As afirmações abaixo vêm de leitura de código-fonte, de documentação
pública V2 e de material público sobre o ecossistema.

## 1. Fontes consultadas

| Fonte | Tipo | Uso |
| --- | --- | --- |
| `~/.config/opencode/plugins/blob-office.ts` | Código, leitura local | Entender a arquitetura e os limites da referência |
| `~/.config/opencode/plugins/blob-office.html` | Código, leitura local | Conferir a linguagem visual |
| `~/.config/opencode/plugins/blob-office-INSTALL-NOTES.md` | Notas de instalação | Proveniência, porta, segurança |
| Documentação V2: plugins, cliente, API, instruções | Documentação pública | Confirmar o contrato das operações |
| Repositório `Caffa/Session-Character-Visualizer` | Metadados via API do GitHub | Verificar licença |
| Ecossistema de ferramentas de worktree por agente | Material público | Levantar padrões e armadilhas |

## 2. Achado principal: a arquitetura D12 era necessária, não opcional

O código da referência contém este comentário, que explica sua limitação
central:

> *"ctx.session has no list() in V2, so agents are created the first time any
> event mentions a session."*

Cruzando as três fontes:

| Superfície | Enumera sessões já existentes? |
| --- | --- |
| Contexto de plugin (`ctx.session`, docs de plugins V2) | Não. Expõe `create`, `get`, `remove`, `move`, `prompt`, entre outros, sem `list` |
| Cliente HTTP `@opencode/client` (docs de cliente) | Sim. `client.session.list(...)` consta dos exemplos |
| CLI oficial (`opencode docs/cli`) | Sim. `opencode session list`, `delete`, `export` |

**Consequência para o TreeOffice:** uma solução baseada apenas em plugin não
conseguiria montar a árvore a partir das sessões existentes — só veria o que
emitisse eventos depois do carregamento. A ponte com cliente HTTP enumera de
verdade. D12 passa a ter justificativa técnica, não apenas preferência.

**Verificação pendente:** confirmar na Etapa 3, contra a instalação autorizada,
o formato exato de `session.list` e o contrato de paginação.

## 3. Vocabulário real de estados

Eventos observados no código da referência, úteis para mapear os estados
visuais na Etapa 3:

- Ciclo de vida: `session.created`, `session.deleted`, `session.renamed`,
  `session.viewed`, `session.status`, `session.idle`, `session.error`.
- Trabalho: `session.tool.input.started`, `session.tool.success`,
  `session.tool.failed`, `session.reasoning.started`, `session.text.started`,
  `session.step.started`.
- Execução: `session.execution.started`, `.failed`, `.succeeded`,
  `.interrupted`.
- Permissão: `permission.asked`, `permission.replied`.
- Serviço: `server.instance.disposed`.
- Hooks de ferramenta: `execute.before`, `execute.after`.

O mapeamento definitivo para os estados visuais continua pendente e permanece
na Etapa 3, conforme D16. A lista acima é o insumo, não a decisão.

## 4. Licença: bloqueio confirmado

O repositório de origem do Blob Office
(`Caffa/Session-Character-Visualizer`, 16 estrelas, último push em
09/04/2026, não arquivado) possui **`license: null`**, ou seja, **sem
licença declarada**. Na ausência de licença, todos os direitos ficam
reservados por padrão.

Decorre disso D24: **zero reuso** de código, assets ou arquivos visuais da
referência. Nada é copiado para o TreeOffice, nem o esboço p5.js. A referência
serve exclusivamente como linguagem visual de comparação.

## 5. Lições do ecossistema

Ferramentas equivalentes verificadas: Vibe Kanban, Nimbalyst, Superset,
Conductor, OpenChamber, Open Session, vibe-tree e o dashboard de sessões do
marcnuri.

| Lição | Consequência para o plano |
| --- | --- |
| Quase todas fazem merge, PR e revisão no GUI | Nosso escopo continua excluindo essas operações; ficamos deliberadamente mais estreitos |
| "Worktrees não são suficientes": resolvem isolamento, não coordenação | Reforça D10. O valor do painel é visibilidade e organização controlada pelo usuário |
| A empresa do Vibe Kanban fechou em abril de 2026 e o projeto passou à comunidade | Reforça D12: solução local, sem nuvem e sem terceiro dono do fluxo |
| O app Desktop do OpenCode já tem lista de sessões, renomeação e arquivamento | Competir em "listar sessões" seria reconstruir o existente. O diferencial é a árvore organizacional com contexto de worktree e branch |

## 6. Divergências deliberadas em relação à referência

| Referência faz | TreeOffice faz | Fundamento |
| --- | --- | --- |
| Apaga blobs de subagentes após 3 s e de agentes principais após 10 s de inatividade | Chat parado ou concluído permanece visível em estado dormente | D16 |
| WebSocket em `ws://localhost:2727` sem autenticação | Ponte local autenticada, restrita à máquina local, com validação de origem | `SEGURANCA.md` |
| Carrega p5.js de CDN, exigindo internet | Biblioteca servida localmente pela ponte, funcionando offline | D25 |
| Escreve estado na pasta global de plugins (`.viewer-opened-today`, `blob-office.settings.json`) | Estado em `.local/`, dentro da pasta do projeto | D20 |
| Detecta agentes por eventos, sem inventário persistente | Inventário próprio persistente, com releitura após desconexão | D21, `SEGURANCA.md` |

## 7. Verificações pendentes

Todas começam por dados simulados e repositórios descartáveis. Status em
12/10/2026, após as chamadas somente leitura descritas no §8:

| # | Pendência | Status | Impacto se falhar |
| --- | --- | --- | --- |
| V01 | Contrato de `session.list`: parâmetros, filtros e paginação | **Comprovado** (§8): parâmetros confirmados, paginação por cursor | — |
| V02 | Como ler o destino de worktrees configurado pelo projeto | Pendente — a lista de worktrees por projeto foi comprovada (§8); falta a configuração de destino do projeto, na Fase D | O painel pode sugerir destino divergente do projeto (D28) |
| V03 | Suporte a chave de idempotência nas operações de criação | Pendente — Fase C | Sem suporte, a anti-duplicação depende só de confirmação (D34) |
| V04 | Comportamento com múltiplos projetos simultâneos | **Comprovado** (§8): a listagem de projetos devolve vários; falta o teste em descartáveis, na Fase C | Risco de confundir projetos entre si |
| V05 | Se o plugin oficial de gerenciamento de sessões já oferece árvore | Pendente — leitura de documentação | Pode reduzir ou mudar o diferencial do TreeOffice |
| V06 | Se `worktree.create` executa de fato scripts de preparação no ambiente do usuário | Pendente — Fase D, em repositório descartável com preparação conhecida | O texto do popup (D30) precisa de ajuste |

## 8. Contrato do serviço local — comprovado em 12/10/2026

**Natureza:** verificado contra a instalação real do usuário (serviço em
`http://127.0.0.1:49374`, OpenCode v2.0.15), por chamadas somente leitura via
`opencode api` (mesmo fluxo de descoberta e autenticação da TUI). Nada foi
criado, alterado ou removido. **Valores observados (ids, títulos, diretórios)
não são registrados aqui por D23** — apenas a forma do contrato.

| Item | Forma comprovada |
| --- | --- |
| Lista de sessões | `GET /api/session` com `limit`, `order`, `search`, `parentID`, `directory`, `project`, `subpath`, `cursor`. Resposta: `{ data: Session.Info[], cursor: { previous, next } }` — paginação por cursor com âncora `{id, time, direction}` |
| `Session.Info` | `id`, `parentID`, `fork`, `projectID`, `agent`, `model`, `cost`, `tokens`, `outcome`, `time`, `title`, `subpath`, `metadata`, `permissions`, `revert`, `location`. Na resposta real observada: `id, projectID, agent, model, cost, tokens, outcome, time, title, location` |
| `time` de sessão | `{ created, updated, idle, viewed }` — insumo para o mapeamento de estados (D16) |
| `location` | `{ directory }` — contexto de trabalho do chat |
| Projetos | `GET /api/project` devolve array; itens com `id`, `canonical`, `time`, `sandboxes` e, em alguns, `vcs` |
| Eventos | `GET /api/event` serve `text/event-stream` (SSE) — vivacidade, não inventário (D33) |
| Worktrees | `GET /api/worktree?projectID=...` (sem `projectID` devolve 400). Resposta: array de `{ directory }`. Existem também os esquemas `Worktree.CreateInput` e `Worktree.RemoveInput`, para as fases de criação |
| Criação de sessão | `POST /api/session` existe no contrato (`id`, `title`, `agent`, `model`, `location`, `metadata`…) — **fora do escopo atual**, pertence à Fase C |

**Consequências:** D46 fica assentada em evidência (HTTP com `fetch` do Node,
sem dependência nova). A enumeração da árvore pode nascer das sessões reais; o
cursor resolve a paginação sem varredura. A autenticação usa o mesmo caminho
do TUI — a credencial do serviço continua existindo só no processo, nunca no
estado local, nos logs ou na documentação (D41).
