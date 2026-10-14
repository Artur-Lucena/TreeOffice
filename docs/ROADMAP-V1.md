# Roadmap da V1 do TreeOffice

**Atualização em 14/10/2026:** UI reformulada e aprovada (D54–D57: tipografia local, naipes centrais, organização livre persistente, fios selecionáveis, diálogos animados). Commit `f8e5ac3` publicado; **190 verificações verdes** (inclui `browser-ui` em Chromium real). Fase B segue somente leitura sem UI de vínculo real; Fases C–F continuam nos portões abaixo.

**Aprovado em:** 12 de outubro de 2026, pelo usuário (fases A–F como base).
**Estado:** Fase A concluída. Fase B autorizada e parcial: pesquisa inicial de
B1 feita e B2 parcial; cliente HTTP ainda não implementado. Trabalho pausado
em 12/10/2026 a pedido do usuário. Fases C a F dependem de autorização própria
(D11).
**Base:** [PLANO-CONSOLIDADO](PLANO-CONSOLIDADO.md) (decisões), [DECISOES](DECISOES.md)
(D01–D46), [PESQUISA](PESQUISA.md) (verificações V01–V06), [PLANEJAMENTO](PLANEJAMENTO.md)
(critérios de aceite).

Este roadmap organiza a execução. Ele não substitui as decisões registradas e
não autoriza, por si só, nenhuma escrita em projetos reais, no vault do
Obsidian ou na configuração global do OpenCode.

## Ambiente verificado em 12/10/2026 (Linux)

| Item | Situação |
| --- | --- |
| Sistema | Ubuntu 26.04 LTS, repositório clonado em `/run/media/tuco/Games/Meus Projetos/TreeOffice` |
| Node.js | Instalado em 12/10/2026 pelo usuário: **v22.22.1** (apt). Requisito mínimo 18.2 satisfeito (D44) |
| OpenCode | CLI em `~/.opencode/bin/opencode`, versão **v2.0.15** (Windows tinha v2.0.26) |
| Blob Office | Não instalado no Linux (`~/.config/opencode/plugins/` vazio). Referência já registrada na PESQUISA; zero reuso (D24) |
| Protótipo | Executado e aprovado no Linux; smoke com 44 ok e renderizador com 11 ok, ambos sem falhas |

## Fase A — retomada e adaptação ao Linux

Risco baixo; nada toca no OpenCode.

| # | Item | Estado |
| --- | --- | --- |
| A1 | Instalar e fixar o runtime Node ≥ 18.2 (método escolhido pelo usuário; outro chat de outro projeto pode fazer a instalação — antes de depender dela, confirmar versão e acessibilidade a este usuário/shell) | Feito em 12/10/2026: Node v22.22.1 |
| A2 | Registrar a correção do cookie HttpOnly (`treeoffice_token`) e cobri-la no smoke test | Feito em 12/10/2026 (6 verificações de cookie; 44 no total) |
| A3 | Rodar `node tests/smoke.mjs` no Linux e registrar o resultado como evidência | Feito em 12/10/2026: 44 ok, 0 falhas, saída limpa, Node v22.22.1 |
| A4 | Avaliação visual do protótipo pelo usuário: árvore, animação, navegação, popup — porta para confirmar ou descartar a p5.js (D19) | Feito em 12/10/2026: aprovado pelo usuário com três defeitos de renderização corrigidos antes; p5.js descartada por D45 |
| A5 | Adaptação multi-SO da documentação (D43, D44): comandos portáteis, caminho do repositório sem absoluto fixo, requisito de Node, versões do OpenCode nos dois sistemas | Feito em 12/10/2026 |
| A6 | Commit e push das mudanças de A2 e A5 | Feito em 12/10/2026; push para `origin/main` OK |

**Portão de saída:** árvore, animação, navegação e popup aprovados por você;
smoke test verde no Linux; p5.js confirmada ou substituída (D19).

**Nota de 12/10/2026:** durante a preparação do reteste (A4), três defeitos de
renderização foram encontrados por teste com DOM falso e corrigidos — nós
desenhados em NaN (árvore invisível), nó criado sem origem sem âncora, e
subárvore de galho recolhido que continuava desenhada. Cobertura em
`tests/tree-render.mjs` (11 verificações) e em `tests/smoke.mjs`
(44 verificações), ambos verdes no Linux.

## Fase B — integração somente leitura (Etapa 3)

Autorizada pelo usuário em 12/10/2026 (D11). Só lê o serviço local do OpenCode.

| # | Item | Decisões/verificações |
| --- | --- | --- |
| B1 | Contrato do cliente: versão instalada (v2.0.15), endpoint, autenticação; HTTP direto com `fetch` do Node, registrado em D46 | D12, D41 |
| B2 | V01 contrato de `session.list`; V04 múltiplos projetos simultâneos; V05 plugin oficial de sessões | PESQUISA §7 |
| B3 | Mapear eventos do serviço para os estados visuais (ativo, dormente, vazio, não encontrado, incerto) | D16, D32 |
| B4 | Inventário persistido + releitura completa na reconexão; eventos só para vivacidade | D21, D33 |
| B5 | Trocar a simulação por dados reais, mantendo o mock como caminho de teste | D25 |

**Andamento em 12/10/2026:** pesquisa inicial de B1 feita e escolha do cliente
registrada em D46 (HTTP com `fetch` do Node, sem dependência nova). Contrato
inspecionado e leituras feitas via CLI em [PESQUISA](PESQUISA.md) §8;
descoberta/autenticação pelo futuro cliente ainda precisam de validação. B2
parcial: V01 tem contrato e amostra de resposta verificados; V04 tem listagem
de vários projetos observada. Faltam os testes descritos no §7, além de V05.
B3 a B5 e o cliente HTTP continuam por implementar.

**Retomada:** seguir o checkpoint em `CONTEXTO-PROJETO.md` §11. Começar pelo
cliente somente leitura com testes simulados; depois integrar inventário,
estados e reconexão. V02, V03 e V06 permanecem nas fases seguintes.

**Portão de saída:** a árvore nasce das sessões reais; queda e reconexão não
perdem nós; estados visuais aprovados.

## Fase C — criar chat e vincular worktree existente (Etapa 4)

Primeira fase com escrita. Testes só em repositórios descartáveis controlados
pelo projeto.

| # | Item | Decisões |
| --- | --- | --- |
| C1 | Criar sessão nova sem histórico herdado, com instruções de entrada digitadas no popup | D04, D13 |
| C2 | Vincular worktree existente sem trocar sua branch; aviso bloqueante e registro quando dois nós de implementação disputam o mesmo worktree | D26, D27 |
| C3 | Anti-duplicação por confirmação, estado incerto e relato de falha parcial sem limpeza destrutiva | D31, D32, D34 |
| C4 | V03 suporte a chave de idempotência nas operações de criação | PESQUISA §7 |

**Portão de saída:** fluxo completo validado em descartáveis, incluindo falhas
provocadas.

**Atualização em 14/10/2026 (D58, parcial):** C1 implementado (ponte cria sessão real em modo real, com chave de idempotência e guarda de Fase D); C2 vincular-existente segue só local com aviso de conflito (D27); C3 incerto sem retry automático; C4 com voo compartilhado. Tudo validado contra serviço simulado + navegador real (207 checks); validado contra serviço real v2.0.28 em 14/10/2026 (sessão criada, visível e idempotente); resta testar worktrees na área descartável.

## Fase D — criar novos worktrees (Etapa 5)

| # | Item | Decisões |
| --- | --- | --- |
| D1 | Origem escolhida explicitamente no popup, nome sugerido e editável, destino lido da configuração do projeto | D28, V02 |
| D2 | Detectar e exibir alterações não commitadas, explicando que não migram; nunca commitar, stashar, resetar, mergear ou copiar arquivos | D29 |
| D3 | Popup declara que a preparação do projeto pode ser executada; V06 comprova o comportamento real | D30, V06 |

**Portão de saída:** criação de worktree validada em descartável com preparação
conhecida; popup aprovado.

## Fase E — Tucofre e dependências (Etapa 6)

Fora do núcleo da V1; entra só com nova decisão do usuário.

| # | Item | Decisões |
| --- | --- | --- |
| E1 | Seleção explícita de um arquivo do vault, lido como texto e apresentado como instruções sugeridas; sem varredura, índice ou escrita | D36, D37, D39 |
| E2 | Arestas de dependência criadas e removidas apenas por ação explícita; nenhum nó é bloqueado | D38 |

**Portão de saída:** leitura selecionada funcionando; vault intacto.

## Fase F — instalação e validação assistada (Etapa 7)

| # | Item | Decisões |
| --- | --- | --- |
| F1 | Início por comando único multi-SO; porta 4717 apenas em `127.0.0.1`; token de 256 bits em `.local/` | D40, D41, D42 |
| F2 | Documentação de execução, dados locais, logs, atualização e desativação, sem registro global | D42 |
| F3 | Revisar com o usuário qualquer registro global antes de aplicá-lo | D12, D42 |
| F4 | Validação assistida: você opera o painel com sessões reais em modo leitura antes de qualquer escrita | D11, D35 |

**Portão de saída:** V1 utilizável por você no dia a dia, com Blob Office, vault
e projetos existentes intactos.

## Regras que valem em todas as fases

- Nenhuma fase escreve em projetos reais, no vault ou na configuração global do
  OpenCode sem autorização específica (D09, D11, D12).
- Worktrees novos só em repositórios descartáveis controlados pelo projeto
  (D26).
- Credenciais do serviço ficam apenas na ponte; o estado local não guarda
  conteúdo de conversa, notas, tokens ou credenciais (D23, D41).
- Verificações começam por dados simulados; nada é declarado funcionando sem
  evidência (ver [SEGURANCA](SEGURANCA.md)).
- Critérios de aceite completos em [PLANO-CONSOLIDADO](PLANO-CONSOLIDADO.md) §6
  e [PLANEJAMENTO](PLANEJAMENTO.md) §3.
