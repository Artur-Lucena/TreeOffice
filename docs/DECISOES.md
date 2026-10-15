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
| D11 | A etapa autorizada foi somente estrutura e documentação; Fase B foi autorizada em 12/10/2026, somente leitura. | Implementação das Fases C a F depende de nova autorização. |
| D12 | Arquitetura: aplicação local independente com ponte local, integrando pela API V2. | Painel web local; credenciais ficam na ponte, fora do navegador; nenhuma alteração na configuração global do OpenCode; porta própria, distinta da 2727. Substitui a proposta de plugin V2 como base. |
| D13 | Escopo da V1: a conversa continua na interface do OpenCode. | A V1 organiza, cria e exibe estado; sem painel de conversa embutido. Remove a proposta de painel lateral de conversa do escopo inicial. |
| D14 | Pastas e projetos entram por cadastro explícito do usuário. | Sem varredura automática de disco; o inventário do OpenCode é lido para exibir, e a organização é decidida pelo usuário. |
| D15 | Modelo visual em três camadas, com vínculo organizacional distinto da relação nativa entre sessões. | Grupos, nós de chat e dependências são camadas separadas; `session.move` e a aresta do painel têm grafia visual diferente. |
| D16 | Estados visuais: chat parado permanece visível; ausência de dado não é desenhada como estado. | Estado dormente para conversas paradas ou concluídas; mapeamento definitivo dos estados na Etapa 3, com dados reais. |
| D17 | Papel organizacional é metadado visual, sem comportamento automático. | Papel não inicia chats, não envia instruções e não cria worktrees. No máximo pré-preenche sugestões no popup de criação, sempre confirmadas pelo usuário. |
| D18 | Um grupo pode ou não ter diretório cadastrado; o vínculo é apenas informativo. | O painel não move, cria nem valida pastas. Grupo sem diretório leva o popup de criação a perguntar o contexto. |
| D19 | p5.js permanece como candidata de renderização. Encerrada por D45. | Fidelidade com a referência visual de D02; a escolha só vira definitiva se o protótipo com dados simulados (Etapa 2) provar árvore orgânica, animada e estável. Ver D45. |
| D20 | Registro local em arquivo JSON único dentro de `.local/`, com campo `schemaVersion`. | Sem banco de dados externo e sem cópias espalhadas; migrações futuras ficam versionadas. |
| D21 | O painel é dono da identidade dos nós; `sessionID` é referência opcional. | Sessão ou caminho cadastrado que deixa de existir gera estado visível de "não encontrado", nunca remoção silenciosa. |
| D22 | Escrita atômica com backup da versão anterior, modo degradado em caso de corrupção e lock de instância única. | Queda de energia, falha de escrita ou segunda instância do painel não zeram nem sobrescrevem a árvore. |
| D23 | O estado local guarda apenas identificadores, rótulos, cadastros de pasta e preferências visuais. | Conteúdo de conversa, notas do Tucofre, credenciais e tokens nunca são persistidos. |
| D24 | Zero reuso de código, assets ou arquivos visuais do Blob Office. | O repositório de origem não possui licença; a referência serve apenas como linguagem visual. Reforça D09, agora com evidência verificada. |
| D25 | p5.js é servida localmente pela ponte; o painel funciona sem internet. Sem objeto após D45: nenhuma biblioteca externa na renderização. | A referência carrega a biblioteca de CDN; o painel segue sem dependência de rede externa. |
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
| D40 | Ponte em porta padrão 4717, configurável, escutando apenas em `127.0.0.1`. | Porta ocupada é informada e o painel não inicia, sem troca silenciosa. O navegador nunca fala com o serviço OpenCode diretamente. |
| D41 | Autenticação por token de 256 bits guardado em `.local/`, exigido em todas as requisições. | Painel é aberto por link impresso pela ponte; requisições de escrita também validam `Origin` e `Host`; credenciais do serviço ficam apenas na ponte. |
| D42 | Início por comando único na pasta do projeto; desativação não exige remoção global. | Parar encerra o processo sem apagar o estado; atualização por pull com backup; logs locais sem conteúdo privado; Blob Office permanece intocado. |
| D43 | O projeto é multi-SO: documentação e comandos portáteis, sem caminho absoluto fixo. | A pasta-mãe é onde o repositório foi clonado (Windows: `D:\Meus Projetos\TreeOffice`; Linux: clone local desde 12/10/2026). Comandos usam barras normais e valem em bash e PowerShell. Complementa D01 sem substituí-la; caminhos históricos do Windows ficam como nota. |
| D44 | Runtime Node 18.2+ é requisito do protótipo; instalar runtime ou pacotes é decisão do usuário. | Nenhuma dependência externa no código. A instalação do Node no ambiente Linux depende de autorização explícita, reforçando AGENTS.md; smoke test no Linux só roda após essa instalação. |
| D45 | p5.js é descartada: o protótipo da Etapa 2 provou árvore orgânica, animada e estável com Canvas 2D puro. | Renderização segue sem nenhuma dependência externa. D19 encerrada por evidência: 11 verificações de renderização e avaliação visual aprovada pelo usuário em 12/10/2026. Pode ser revisitada se a fidelidade visual um dia exigir. |
| D46 | A ponte fala com o serviço local do OpenCode por HTTP com `fetch` do próprio Node — sem `@opencode/client` nem nova dependência. | O contrato foi comprovado contra o serviço real (v2.0.15): `session.list` com paginação por cursor, SSE em `/api/event`, worktrees por `projectID`. Descoberta do endpoint e credencial em runtime, nunca persistidas (D23, D41). |
| D47 | Blob Office removido da pasta global de plugins por ordem explícita do usuário em 13/10/2026, com backup reversível. | Os 4 arquivos foram movidos para pasta de backup fora de `plugins/`; nada foi copiado para o TreeOffice (D24 segue valendo). Substitui a cláusula de preservação do Blob Office em D09. Para reverter, mover os arquivos de volta e reiniciar o serviço OpenCode. |
| D48 | Comando único de entrada `node src/iniciar.mjs`, que sobe a ponte e abre o painel no navegador. | Abertura automática é cortesia e pode ser desativada (`--sem-abrir`, `TREEOFFICE_NO_OPEN=1`); falha ao abrir nunca derruba a ponte. Sem dependências novas, portátil Windows/Linux. |
| D49 | Direção de arte giz-cassino com naipes semânticos, aprovada pelo usuário em 13/10/2026. | Naipe codifica papel (♠ liderança, ♥ execução, ♦ investigação, ♣ estudo; livre sem naipe) no lugar da cor; estados em textura + contorno + brilho; ficha de pôquer marca galho recolhido e worktree (dupla quando compartilhado). Tudo procedural em Canvas, sem asset externo (D24, D25). |
| D50 | Colisão só entre corpos, com âncoras autoritárias, aprovada em 13/10/2026. | Repulsão par a par determinística antes das molas; rótulos livres; irmãos de grupo dividem a órbita (filho único no centro); acessório `_debugPosicoes()` só de leitura para testes. Sem o passe determinístico de grupos — física primeiro. |
| D51 | Correção dos gestos autorizada em 13/10/2026: arrastar nó empurra os vizinhos; arrastar fundo navega. | Ao soltar/cancelar, volta à âncora por mola. Não persiste posição manual nem realiza operações externas. O contato respeita o tamanho do desenho em unidades de mundo, independentemente do zoom. |
| D52 | Correções de vivacidade e naipes autorizadas junto dos defeitos da UI. | Recência e estado suavizam o tamanho; partículas percorrem dependências visuais e brilhos usam composição aditiva. Papel/naipe pode ser escolhido na criação ou no painel; livre continua sem naipe. Sem novas dependências nem mudança de agente/modelo/permissões. |
| D53 | Refino giz v2 autorizado em 13/10/2026: retorno suave, galhos em tubo e tipografia. | Soltar inicia planagem que só termina ao chegar devagar (ou no timeout), com trava anti-estalo sobre o deslocamento total do quadro; galhos em halo + núcleo; títulos de grupo espaçados e títulos de nó com brilho tênue, só com fontes do sistema. |
| D58 | Fase C autorizada em 14/10/2026: criar sessão real e vincular worktree existente, com área de testes descartável em `area-testes/`. | `POST /api/session` no cliente; `POST /api/opencode/sessoes` na ponte só em modo real, com título/chave/diretório validados e idempotência por chave (inclusive com pedidos simultâneos); popup gera a chave por fluxo, cria de verdade em modo real, bloqueia worktree novo (Fase D) e marca incerto sem repetir em pane (D32). Contrato exato do `POST /session` validado contra serviço real (v2.0.28) em
14/10/2026: `{ title }` → `{ id, ... }`; sessão criada aparece no inventário;
replay idempotente devolve a mesma.
| D59 | Fase D autorizada em 14/10/2026 junto das melhorias pesadas: criar worktree novo pela estratégia do projeto. | `POST /api/worktree` no cliente (`worktree.create` real: `{projectID, from?, branch?, directory?, name?}` → `{directory}`); `POST /api/opencode/worktrees` na ponte só em modo real, com idempotência e voo compartilhado via ajudante comum; popup resolve o projeto pela pasta canônica, declara o setup (D30) e cria worktree antes da sessão, parando na primeira pane (D32). Contrato lido do `/openapi.json` real. Validação ao vivo só em descartável, ainda pendente.<br>**Validado ao vivo em 14/10/2026:** area-testes/demo registrada como projeto via uso do CLI no diretório (sem editar config global); worktree wt-validacao criado de verdade via ponte (201, detached HEAD pela estratégia do serviço); E2E no navegador: sessão real + worktree vinculado + ocupação registrada, branch intacta. |
| D60 | Fase E autorizada em 15/10/2026: leitura selecionada do Tucofre (E1) e remoção explícita de dependências (E2). | E1: botão “Ler arquivo do Tucofre” na Etapa 1 do popup, arquivo lido como texto no próprio navegador (FileReader, limite 64 KB recusado com aviso; teto de 4000 caracteres com aviso de corte, igual ao digitado); só o texto confirmado entra nas instruções; nenhum caminho do vault é pedido, guardado ou enviado à ponte; nome do arquivo nunca persistido (D23, D39). E2: inspetor lista as arestas do nó selecionado, cada uma com remover + confirmação; criação segue explícita; nenhum nó é apagado ou bloqueado (D38). Validado em navegador real com arquivos temporários descartáveis (browser-ui 22 ok). |
| D61 | Fase F autorizada em 15/10/2026: fechar instalação e validação assistida. | Auditoria em 15/10/2026: ponte e cliente só escrevem em `.local/` (`bridge.json` com modo 0600, `state.json` + backups atômicos); descoberta do OpenCode é só leitura de `service.json`; nenhum registro global, nenhuma dependência nova. CONTEXTO §2 e README sincronizados; checklist de validação assistida entregue no chat (F4). |

## Atualização aprovada em 14/10/2026

- **D54 — UI minimalista com paleta preservada, Amarante nos títulos e Manrope nos controles.** Naipes estampados dentro dos módulos; fontes OFL servidas localmente, com licenças no repositório. Substitui a tipografia apenas do sistema de D53; não acrescenta framework nem dependência de rede em execução.
- **D55 — Organização manual livre e persistente.** Módulos deslizam até o cursor e permanecem no destino; colisões separam os corpos; o centro dos grupos acompanha seus membros. Substitui as âncoras autoritárias/retorno de D50, D51 e D53. Posições explicitamente organizadas são salvas em `.local/`, sem alterar sessões ou projetos.
- **D56 — Conexões selecionáveis com metadados e ramificações visuais.** Fios uniformes, sem partículas, com nome e notas digitados explicitamente pelo usuário. A ramificação conserva um ponto paramétrico da curva de origem. D38 passa a distinguir dependências pelo tipo no inspetor, em vez de pontilhado. D23 permite apenas essas notas visuais digitadas no painel; histórico de conversa, vault, tokens e credenciais continuam excluídos.
- **D57 — Diálogos arrastáveis e transições com mola, fade e slide.** Referência: Animate UI Dialog/Sheet; implementação própria em JavaScript e Web Animations, respeitando movimento reduzido e efeitos desligados. Módulos e fios aparecem/desaparecem gradualmente ao expandir/recolher galhos; reabrir cancela a saída anterior.

O usuário aprovou aplicar ao projeto e enviar ao GitHub as melhorias avaliadas na prévia. A autorização cobre o código e o Git deste repositório; não autoriza criar sessões/worktrees reais nem modificar a configuração do OpenCode. O fluxo original de novo chat continua perguntando sobre worktree. Ramificar diretamente um fio cria apenas um módulo visual, sem sessão.

## Propostas ainda abertas

- Completar as verificações V01/V04 e resolver V02 (destino de worktrees configurado pelo projeto), V03 (idempotência), V05 (plugin oficial de sessões) e V06 (preparação do projeto), conforme as evidências e limitações em [PESQUISA](PESQUISA.md) §7.
- Integração com o vault do Tucofre (D36, D37) — fora da V1, depende de nova decisão.

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
| 7 | Instalação, autenticação, verificação e plano consolidado | Fechada (D40, D41, D42) |
| 8 | Adaptação multi-SO e retomada no Linux | Fechada (D43, D44) |
| 9 | Encerramento da Etapa 2 e contrato do serviço | Fechada (D45, D46) |
| 10 | Substituição do Blob Office e comando de entrada | Fechada (D47, D48) |
| 11 | Direção de arte giz-cassino | Fechada (D49) |
| 12 | Colisão entre corpos | Fechada (D50); passe de grupos adiado |
| 13 | Refino giz v2: retorno, galhos e tipo | Fechada (D53) |

Todas as rodadas de decisão foram fechadas: as Rodadas 1 a 7 em 12/10/2026, a
Rodada 8 no mesmo dia (retomada no Linux) e a Rodada 9 em 12/10/2026
(p5.js descartada por D45; cliente HTTP do serviço definido por D46, já
comprovado contra a instalação local). O plano consolidado está em
[PLANO-CONSOLIDADO](PLANO-CONSOLIDADO.md), a pesquisa em [PESQUISA](PESQUISA.md)
e o roadmap de execução da V1, em [ROADMAP-V1](ROADMAP-V1.md). A implementação
da Fase B foi autorizada pelo usuário em 12/10/2026, somente leitura. As Fases
C a F dependem de autorização própria; a integração com o Tucofre exige nova
decisão (D11, D36). O trabalho foi pausado a pedido do usuário, com ponto de
retomada em `CONTEXTO-PROJETO.md` §11.

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
