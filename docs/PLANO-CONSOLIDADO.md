# Plano consolidado do TreeOffice

**Fechado em:** 12 de outubro de 2026.
**Estado:** decisões de desenho completas. A aplicação integrada ao OpenCode
não foi implementada, instalada, executada ou testada contra uma instalação
real. O protótipo da Etapa 2 existe em `src/` (Node puro, dados simulados) e
aguarda avaliação visual do usuário; o roadmap de execução da V1 está em
[ROADMAP-V1](ROADMAP-V1.md).
**Depende de:** autorização do usuário para iniciar a implementação (D11).

Este documento consolida o resultado das sete rodadas de fechamento. As
decisões individuais estão em [DECISOES](DECISOES.md); a pesquisa que sustenta
parte delas, em [PESQUISA](PESQUISA.md).

## 1. O que o TreeOffice é

Um painel local, separado do Blob Office, que permite ver, organizar e criar
chats ligados a projetos e worktrees em uma árvore orgânica, dinâmica e
animada. O usuário distribui tarefas, confere evidências e acompanha
dependências; o painel apenas descreve e executa o que ele pede.

## 2. O que o TreeOffice não é

- Não é orquestrador de agentes nem executor autônomo de tarefas.
- Não faz merge, commit, rebase, stash, reset, push nem abre pull request.
- Não é cliente de chat: na V1, conversar acontece na interface do OpenCode
  (D13).
- Não lê o vault do Obsidian (D36).
- Não altera configuração global do OpenCode, não toca no Blob Office e não
  reorganiza projetos existentes.
- Não remove sessões, branches ou worktrees; no máximo desfaz vínculos visuais.

## 3. Arquitetura

| Camada | Escolha | Fundamento |
| --- | --- | --- |
| Forma | Aplicação local independente, com ponte local e UI web | D12. Um plugin V2 não conseguiria listar sessões existentes; ver [PESQUISA](PESQUISA.md) §2 |
| Comunicação | Ponte fala com o OpenCode pelo cliente HTTP e pelo serviço local, que resolvem endpoint e autenticação | D12, D41. Credenciais ficam apenas na ponte |
| Renderização | p5.js como candidata, a validar no protótipo | D02, D19, D25 |
| Estado | Arquivo JSON único em `.local/`, versionado, fora do Git | D20, D22, D23 |
| Exposição | Porta 4717 apenas em `127.0.0.1`, token de 256 bits, `Origin` e `Host` validados | D40, D41 |

## 4. Contrato de dados (esboço)

O esboço abaixo orienta a implementação; os nomes definitivos saem da Etapa 1
de implementação, sem alterar as decisões registradas.

```jsonc
{
  "schemaVersion": 1,
  "grupos": [
    { "id": "g_...", "titulo": "...", "papel": "...", "diretorioCadastrado": null }
  ],
  "nos": [
    {
      "id": "n_...",
      "titulo": "...",
      "papel": "...",
      "sessionID": null,
      "grupoPai": "g_...",
      "worktree": null,
      "estado": "vazio | ativo | dormente | nao_encontrado | incerto"
    }
  ],
  "dependencias": [{ "origem": "n_...", "destino": "n_..." }],
  "ocupacaoWorktree": [{ "worktree": "...", "noID": "n_...", "confirmadoEm": "..." }],
  "cadastros": [{ "caminho": "...", "projetoID": "..." }],
  "preferencias": {}
}
```

Regras do contrato:

- O painel é dono do `id` de cada nó; `sessionID` é referência opcional (D21).
- Sessão ou caminho que deixa de existir produz estado `nao_encontrado`, nunca
  remoção silenciosa (D21).
- `ocupacaoWorktree` é o que sustenta o aviso de compartilhamento (D27).
- Nenhum campo guarda conteúdo de conversa, notas, credenciais ou tokens (D23).
- O arquivo tem backup da versão anterior e lock de instância única (D22).

## 5. Etapas e portões de liberação

| Etapa | Conteúdo | Portão de saída | Autorização |
| --- | --- | --- | --- |
| 0 | Estrutura e documentação | Concluída | Já dada |
| 1 | Fechamento do plano | Concluída com este documento | Já dada |
| 2 | Protótipo visual com dados simulados | Árvore orgânica, animada e estável; popup e navegação aprovados; funciona offline | Implementação (D11) |
| 3 | Integração somente leitura | Verificações V01 a V06 respondidas; enumeração, inventário e reconexão comprovados | Implementação (D11) |
| 4 | Ações explícitas de criação | Criar chat sem histórico herdado e vincular worktree existente, testados em repositórios descartáveis | Implementação (D11) |
| 5 | Criação de novos worktrees | Fluxo completo do popup validado em descartáveis, incluindo preparação do projeto | Implementação (D11) |
| 6 | Tucofre e dependências | Leitura de arquivo explicitamente selecionado, sem varredura nem escrita | Nova decisão |
| 7 | Instalação e validação assistida | Documentação de execução, dados locais, logs, atualização e desativação | Implementação (D11) |

Nenhuma etapa escreve em projetos reais, no vault ou na configuração global do
OpenCode. Testes usam dados simulados e repositórios descartáveis controlados
pelo projeto.

## 6. Critérios de aceite consolidados

**Aparência e estado**

- Árvore visualmente orgânica e animada, coerente com a referência.
- Chat parado ou concluído permanece visível em estado dormente (D16).
- Ausência de dado nunca é desenhada como estado.
- Atualizações não provocam saltos desnecessários na árvore.
- Painel funciona sem internet, com a biblioteca de renderização servida
  localmente (D25).

**Abrir e criar**

- Abrir o painel não cria chats, worktrees ou tarefas.
- Criar galho apresenta a pergunta sobre worktree (D03).
- Cancelar o fluxo não dispara operações de criação.
- Novo chat não recebe histórico de outro chat (D04).
- Instruções e tarefa são inseridas somente quando escolhidas explicitamente.
- Na V1, conversar acontece na interface do OpenCode (D13).
- O painel não abre nem lê o vault (D36).

**Projetos, worktrees e escrita**

- Projetos e repositórios diferentes não são confundidos.
- Worktree existente pode ser vinculado sem mudar sua branch.
- Worktree compartilhado exige confirmação explícita e fica registrado (D27).
- Painel nunca executa commit, stash, reset, merge nem cópia de arquivos entre
  diretórios (D29).
- Nova branch não nasce de uma referência escolhida em silêncio (D28).
- Popup de criação informa que a preparação do projeto pode ser executada (D30).
- Criação não dispara scripts ou alterações em arquivos silenciosamente.

**Resiliência**

- Falha no meio de um fluxo é relatada, sem remoção automática do que foi
  criado (D31).
- Estado incerto leva a verificar, nunca a presumir ou repetir sozinho (D32).
- Nenhum nó desaparece porque um evento foi perdido (D33).
- Reconexão recompõe o estado atual sem depender de eventos perdidos.
- Queda do painel ou do serviço não apaga nem corrompe a árvore salva (D22).
- Remover vínculo visual não remove sessão, branch ou worktree.

**Segurança e privacidade**

- Ponte escuta apenas em `127.0.0.1`, exige token em toda requisição e valida
  `Origin` e `Host` nas escritas (D40, D41).
- Credenciais do serviço OpenCode não aparecem no navegador, no estado local
  nem no repositório (D23, D41).
- Estado local não contém conteúdo de conversa, notas do vault, credenciais ou
  tokens (D23).
- Painel não varre o disco em busca de pastas ou do vault (D14, D39).
- Sessão aguardando permissão é exibida e aberta no OpenCode, não respondida
  pelo painel (D35).
- Blob Office, vault e projetos anteriores permanecem inalterados (D09).
- Painel não altera configuração global do OpenCode (D12).

## 7. Verificações pendentes

Seis itens permanecem sem comprovação e são tarefa da Etapa 3, listados com
método e impacto em [PESQUISA](PESQUISA.md) §7: contrato de `session.list`,
destino de worktrees configurado pelo projeto, suporte a idempotência,
comportamento com múltiplos projetos, sobreposição com o plugin oficial de
sessões e execução real da preparação do projeto.

## 8. O que exige nova autorização do usuário

- Iniciar qualquer implementação (D11).
- Escrever em projetos reais, no vault ou na configuração global do OpenCode.
- Criar worktrees em projetos reais — apenas descartáveis, sem novo aval.
- Reutilizar código ou assets do Blob Office — proibido (D24).
- Alterar o escopo da V1 ou incluir terceiros no projeto.

## 9. Riscos conhecidos

| Risco | Mitigação |
| --- | --- |
| Contrato da API não verificado contra instalação real | Etapa 3 com dados simulados e leituras antes de qualquer escrita |
| p5.js pode não entregar árvore estável e animada | D19: só vira escolha definitiva se o protótipo provar |
| A API pode mudar entre versões do OpenCode | Verificar a versão instalada antes de implementar; conteúdo das etapas 3 e 4 |
| Compartilhamento acidental de worktree | D27: aviso bloqueante com confirmação e registro |
| Criação duplicada por falha de comunicação | D32 e D34: estado incerto e confirmação explícita |