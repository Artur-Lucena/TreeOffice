# Instruções para assistentes do TreeOffice

## Entrada obrigatória

Antes de propor mudanças, leia nesta ordem:

1. `CONTEXTO-PROJETO.md`.
2. `docs/DECISOES.md`.
3. `docs/PLANEJAMENTO.md`.
4. `docs/SEGURANCA.md`.

Use português na comunicação e na documentação, salvo solicitação diferente.

## Fase e autorização

- A Etapa 2 foi concluída e aprovada. A Fase B (integração somente leitura) foi
  autorizada; o trabalho foi pausado em 12/10/2026 a pedido do usuário. Retomar
  quando ele solicitar, a partir de `CONTEXTO-PROJETO.md` §11. A autorização
  inicial cobriu somente estrutura e documentos; fases seguintes têm escopo
  próprio de aprovação.
- Não interpretar a existência de `src/`, `tests/` ou `scripts/` como autorização
  para implementar, instalar dependências ou executar automações.
- Fechar o plano com o usuário antes de iniciar implementação.
- Respeitar o modo e as restrições do agente ativo. Estes documentos não
  autorizam contornar o modo Plan.
- Não iniciar chats, subagentes ou distribuição automática de tarefas. O usuário
  controla a delegação e a aprovação das entregas.

## Papel do assistente principal

- Conduzir o planejamento, revisar o roadmap e identificar dependências.
- Distinguir decisões confirmadas, propostas e perguntas em aberto.
- Pedir apenas informações necessárias para a etapa atual.
- Registrar decisões aprovadas quando houver autorização de escrita.
- Exigir evidências e critérios verificáveis para futuras entregas.
- Não tratar o plano como fechado enquanto existirem decisões bloqueadoras.

## Requisitos que não devem ser reinterpretados

- Visual orgânico e animado, semelhante ao Blob Office.
- Novos chats começam sem histórico herdado; vínculo visual não significa fork.
- A criação de um galho pergunta, em um pequeno popup, se haverá novo worktree.
- Subassistentes que alteram código usam branches e worktrees exclusivos.
- Pastas e nós não iniciam nem sincronizam chats automaticamente.
- GameDev foi um exemplo, não um caminho real ou uma estrutura obrigatória.
- Tucofre é o vault do Obsidian do usuário; seu caminho não foi informado.
- TreeOffice deve adaptar-se aos projetos existentes, nunca reorganizá-los.

## Limites de acesso e escrita

- Todo o código, documentação e recursos do TreeOffice ficam na pasta deste
  repositório — originalmente `D:\Meus Projetos\TreeOffice` no Windows e, desde
  12/10/2026, também clonado no Linux (D43). A documentação evita caminho
  absoluto fixo; novos textos devem valer nos dois sistemas.
- O projeto é multi-SO: comandos e caminhos na documentação são portáteis
  (barras normais, bash). Não presuma Windows.
- O protótipo exige Node 18.2 ou mais recente no ambiente; instalar runtime,
  pacotes ou dependências depende de autorização explícita do usuário (D44).
- Não modificar projetos externos, o vault do Obsidian ou o Blob Office sem
  autorização específica para uma operação claramente delimitada.
- Não alterar configuração global do OpenCode, iniciar serviços ou abrir chats
  como parte de verificações automáticas.
- Não copiar o código do Blob Office para cá antes de verificar licença e
  compatibilidade. Por enquanto ele é apenas referência.
- Não mover diretórios, trocar branches, fazer commit, stash, reset, merge ou
  excluir worktrees como efeito implícito de uma ação visual.
- Não herdar nem alterar agentes, modelos ou permissões de chats existentes.
- Não armazenar credenciais ou conteúdo privado de sessões na documentação.

## Direção técnica

- A integração terá como referência a API do OpenCode V2.
- Arquitetura, stack, instalação e persistência ainda precisam ser decididas.
- p5.js e uma ponte local são propostas, não escolhas técnicas definitivas.
- Quando for tratar de APIs ou configuração do OpenCode, consultar a documentação
  V2 atual e confirmar o contrato da instalação antes de implementar.
- Não confundir hierarquia organizacional, relação nativa entre sessões,
  estrutura de diretórios, worktrees e dependências de tarefas.

## Verificação

O protótipo não tem build nem dependências externas. Os comandos de execução
e testes estão em `src/README.md`: `node src/server/bridge.mjs`,
`node tests/smoke.mjs` e `node tests/tree-render.mjs`. Não inventar resultados
de testes. Diferenciar validação documental, testes simulados, leituras via
CLI e testes da integração contra uma instalação real.

Futuras verificações começam com dados simulados e repositórios descartáveis
controlados pelo projeto, nunca com operações de escrita nos projetos atuais.
