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
| D20 | Registro local em arquivo JSON único dentro de `.local/`, com campo `schemaVersion`. | Sem banco de dados externo e sem cópias espalhadas; migrações futuras ficam versionadas. |
| D21 | O painel é dono da identidade dos nós; `sessionID` é referência opcional. | Sessão ou caminho cadastrado que deixa de existir gera estado visível de "não encontrado", nunca remoção silenciosa. |
| D22 | Escrita atômica com backup da versão anterior, modo degradado em caso de corrupção e lock de instância única. | Queda de energia, falha de escrita ou segunda instância do painel não zeram nem sobrescrevem a árvore. |
| D23 | O estado local guarda apenas identificadores, rótulos, cadastros de pasta e preferências visuais. | Conteúdo de conversa, notas do Tucofre, credenciais e tokens nunca são persistidos. |
| D24 | Zero reuso de código, assets ou arquivos visuais do Blob Office. | O repositório de origem não possui licença; a referência serve apenas como linguagem visual. Reforça D09, agora com evidência verificada. |
| D25 | p5.js é servida localmente pela ponte; o painel funciona sem internet. | A referência carrega a biblioteca de CDN; o protótipo precisa provar funcionamento offline. |
| D26 | Vincular worktree existente vem antes de criar novos; criação testada só em repositórios descartáveis. | Reduz o alcance das operações de escrita na V1 e mantém os testes longe dos projetos reais. |
| D27 | Compartilhar worktree entre dois nós de implementação exige aviso bloqueante com confirmação explícita, registrado no estado local. | Conflito nunca fica oculto; bloqueio absoluto seria inflexível demais para casos legítimos de leitura ou revisão. |
| D28 | Origem, nome e destino de novos worktrees: origem é a referência atual do repositório canônico, escolhida explicitamente no popup; nome é sugerido a partir do título e sempre editável; destino é o que o projeto configurou. | O painel não impõe nomenclatura nem destino. Nenhuma operação assume `main` em silêncio. |
| D29 | Alterações não commitadas são detectadas e exibidas; a decisão de criar ou não é do usuário. | O painel explica que essas alterações não migram para o novo worktree, e nunca faz commit, stash, reset, merge ou cópia de arquivos entre diretórios. |
| D30 | O popup de criação declara que a operação pode executar a preparação configurada pelo projeto. | Criar worktree carrega configuração e plugins do diretório canônico; a operação nunca é apresentada como "criar uma pasta". |
| D31 | Nenhuma limpeza destrutiva automática. | Fluxo que falha no meio é relatado e interrompido; desfazer é decisão do usuário, com aviso de que remover sessão pode remover descendentes. |
| D32 | "Estado incerto" é um estado de primeira classe. | Falha de comunicação no meio de uma operação leva a verificar o inventário, nunca a presumir sucesso ou falha, e nunca a re-executar sozinho. |
| D33 | Reconexão acontece por releitura completa, não por eventos. | Eventos servem para vivacidade; nós do painel nunca desaparecem porque um evento foi perdido. |
| D34 | Anti-duplicação por confirmação explícita. | Pedido que o registro indica já ter sido tentado gera aviso e pergunta; nunca criação duplicada em silêncio. |
| D35 | O painel não responde a permissões pendentes. | O estado é exibido com atalho para abrir a sessão no OpenCode; responder permissão é escrita com consequência e fica fora do escopo da V1. |
| D36 | A V1 não lê o vault do Obsidian. | Instruções de entrada são digitadas pelo usuário no popup; a integração com o vault pertence à Etapa 5. |
| D37 | Integração futura com o vault: seleção explícita de um arquivo, lido como texto e apresentado como instruções sugeridas. | Sem suposições sobre front-matter, sem varredura, sem indexação, sem escrita e sem sincronização. |
| D38 | Dependências do roadmap são arestas pontilhadas criadas e removidas apenas por ação explícita do usuário. | O painel informa, nunca impõe: não detecta dependência do vault sozinho e não bloqueia nó algum. |
| D39 | O caminho do vault só é solicitado quando uma etapa aprovada precisar dele. | Nenhum caminho externo é pedido durante o fechamento do plano. |

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
| 3 | Persistência dos vínculos | Fechada (D20, D21, D22, D23) |
| 4 | Worktrees: vinculação, criação e confirmações | Fechada (D26, D27, D28, D29, D30); leitura do destino configurado pelo projeto a verificar na Etapa 3 |
| 5 | Falhas parciais, recuperação e anti-duplicação | Fechada (D31, D32, D33, D34, D35) |
| 6 | Tucofre e dependências | Fechada (D36, D37, D38, D39); sem bloqueio para a V1 |
| 7 | Instalação, autenticação, verificação e plano consolidado | Em andamento |

## Pesquisa de referência

Concluída em 12/10/2026, com registro em [PESQUISA](PESQUISA.md).

| ID | Decisão | Consequência |
| --- | --- | --- |
| D24 | Zero reuso de código, assets ou arquivos visuais do Blob Office. | Repositório de origem sem licença; referência é apenas linguagem visual. |
| D25 | p5.js servida localmente pela ponte. | Painel funciona sem internet; sem dependência de CDN. |

A pesquisa também confirmou, por evidência, que a arquitetura D12 não era
apenas preferência: o contexto de plugin V2 não expõe listagem de sessões,
enquanto o cliente HTTP expõe. Detalhes em `PESQUISA.md`.

## Proposta substituída

Herdar a conversa do chat de origem foi sugerido no início. A decisão D04
substitui essa proposta: os novos chats são independentes e começam novos.

## Como registrar novas decisões

Quando houver autorização de escrita, acrescentar uma decisão somente após
aprovação explícita do usuário. Registrar impacto e, quando aplicável, qual
decisão anterior foi substituída. Manter propostas pendentes claramente marcadas.
