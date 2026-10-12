# Instruções para assistentes do TreeOffice

## Entrada obrigatória

Antes de propor mudanças, leia nesta ordem:

1. `CONTEXTO-PROJETO.md`.
2. `docs/DECISOES.md`.
3. `docs/PLANEJAMENTO.md`.
4. `docs/SEGURANCA.md`.

Use português na comunicação e na documentação, salvo solicitação diferente.

## Fase e autorização

- A fase atual é planejamento. A autorização inicial cobriu somente a criação
  desta estrutura e dos documentos de contexto.
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

- Todo o código, documentação e recursos do TreeOffice ficam em
  `D:\Meus Projetos\TreeOffice`.
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

Neste estado não existem comandos de build, execução ou testes da aplicação.
Não inventar resultados de testes. Diferenciar validação documental, testes
simulados e testes contra uma instalação real.

Futuras verificações começam com dados simulados e repositórios descartáveis
controlados pelo projeto, nunca com operações de escrita nos projetos atuais.
