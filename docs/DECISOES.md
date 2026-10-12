# Registro de decisões

Este documento separa requisitos confirmados de propostas ainda não aprovadas.
A criação da estrutura não significa aprovação do plano completo.

## Confirmadas

| ID | Decisão | Consequência |
| --- | --- | --- |
| D01 | Nome e pasta-mãe: TreeOffice em `D:\Meus Projetos\TreeOffice`. | Código, documentação e recursos ficam aqui. |
| D02 | Visual dinâmico e animado, semelhante ao Blob Office. | Não substituir a proposta por um diagrama estático genérico. |
| D03 | Ramificar deve abrir um pequeno popup sobre criar worktree. | Não criar worktrees automaticamente. |
| D04 | Novos chats começam sem histórico herdado. | Vínculo visual não aciona fork nem cópia de conversa. |
| D05 | Subassistentes que alteram código usam branches e worktrees próprios. | Adaptar-se ao isolamento já usado pelo usuário. |
| D06 | Pastas não iniciam nem sincronizam chats automaticamente. | Abertura, criação e envio de instruções exigem ação explícita. |
| D07 | GameDev foi somente um exemplo. | Não procurar essa pasta nem impor sua hierarquia. |
| D08 | Tucofre é o vault do Obsidian. | Não presumir API, caminho ou formato dos registros. |
| D09 | Proteger os projetos atuais e preservar o Blob Office. | Nenhuma reorganização ou alteração implícita. |
| D10 | O usuário controla tarefas, evidências e dependências. | Não fazer delegação automática. |
| D11 | A etapa autorizada foi somente estrutura e documentação. | Implementação depende de nova autorização após fechar o plano. |
| D12 | Arquitetura: aplicação local independente com ponte local, integrando pela API V2. | Painel web local; credenciais ficam na ponte, fora do navegador; nenhuma alteração na configuração global do OpenCode; porta própria, distinta da 2727. Substitui a proposta de plugin V2 como base. |
| D13 | Escopo da V1: a conversa continua na interface do OpenCode. | A V1 organiza, cria e exibe estado; sem painel de conversa embutido. Remove a proposta de painel lateral de conversa do escopo inicial. |
| D14 | Pastas e projetos entram por cadastro explícito do usuário. | Sem varredura automática de disco; o inventário do OpenCode é lido para exibir, e a organização é decidida pelo usuário. |
| D15 | Modelo visual em três camadas, com vínculo organizacional distinto da relação nativa entre sessões. | Grupos, nós de chat e dependências são camadas separadas; `session.move` e a aresta do painel têm grafia visual diferente. |
| D16 | Estados visuais: chat parado permanece visível; ausência de dado não é desenhada como estado. | Estado dormente para conversas paradas ou concluídas; mapeamento definitivo dos estados na Etapa 3, com dados reais. |
| D17 | Papel organizacional é metadado visual, sem comportamento automático. | Papel não inicia chats, não envia instruções e não cria worktrees. No máximo pré-preenche sugestões no popup de criação, sempre confirmadas pelo usuário. |
| D18 | Um grupo pode ou não ter diretório cadastrado; o vínculo é apenas informativo. | O painel não move, cria nem valida pastas. Grupo sem diretório leva o popup de criação a perguntar o contexto. |
| D19 | p5.js permanece como candidata de renderização. | Fidelidade com a referência visual de D02; a escolha só vira definitiva se o protótipo com dados simulados (Etapa 2) provar árvore orgânica, animada e estável. |

## Propostas ainda abertas

- Modelo de persistência dos vínculos e preferências.
- Conexões pontilhadas para dependências do roadmap.
- Primeira versão da integração com o Tucofre em leitura selecionada.
- Regra de bloqueio ou aviso quando dois chats de implementação compartilham pasta.
- Nomenclatura, origem e destino dos worktrees novos.
- Distribuição, instalação e autorização de eventuais mudanças globais.

## Rodadas de fechamento

Ordem definida por dependência: a arquitetura raíza as decisões de
persistência, instalação e verificação.

| Rodada | Tema | Estado |
| --- | --- | --- |
| 1 | Arquitetura e escopo da conversa | Fechada (D12, D13) |
| 2 | Organização, papéis e aparência da árvore | Fechada (D14, D15, D16, D17, D18, D19); desenho visual detalhado sai do protótipo da Etapa 2 |
| 3 | Persistência dos vínculos | Aberta |
| 4 | Worktrees: vinculação, criação e confirmações | Aberta |
| 5 | Falhas parciais, recuperação e anti-duplicação | Aberta |
| 6 | Tucofre e dependências | Aberta; pode ser adiada sem travar a V1 |
| 7 | Instalação, autenticação, verificação e plano consolidado | Aberta |

## Proposta substituída

Herdar a conversa do chat de origem foi sugerido no início. A decisão D04
substitui essa proposta: os novos chats são independentes e começam novos.

## Como registrar novas decisões

Quando houver autorização de escrita, acrescentar uma decisão somente após
aprovação explícita do usuário. Registrar impacto e, quando aplicável, qual
decisão anterior foi substituída. Manter propostas pendentes claramente marcadas.
