# Planejamento — ainda em elaboração

**Estado:** estrutura inicial pronta; plano completo não aprovado.

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

### Rodada 2 — organização e aparência (em andamento)

- [ ] Definir como organizar projetos, papéis e sessões sem reorganizar pastas.
  D14 e D15 aprovados; falta detalhar o que é um "papel" na árvore e como
  grupos e sessões se relacionam com diretórios reais.
- [ ] Definir os elementos visuais, estados e navegação da árvore animada.
  Direção aprovada em D16 (estado dormente, ausência de dado não vira estado);
  falta o desenho detalhado, validado no protótipo da Etapa 2.
- [ ] Confirmar a biblioteca de renderização. p5.js segue como proposta.

### Rodada 3 — persistência

- [ ] Definir persistência dos vínculos sem alterar sessões existentes.

### Rodada 4 — worktrees

- [ ] Definir vinculação a worktree existente e exclusividade de subassistentes.
- [ ] Definir origem, nomes, destinos e confirmações para novos worktrees.
- [ ] Definir comportamento diante de alterações não commitadas e scripts de setup.

### Rodada 5 — resiliência

- [ ] Definir falhas parciais, recuperação e prevenção de criação duplicada.

### Rodada 6 — Tucofre e dependências

- [ ] Definir a participação inicial do Tucofre e o formato mínimo dos registros.
  Pode ser adiada sem travar a V1.

### Rodada 7 — instalação e fechamento

- [ ] Definir autenticação local, instalação, configuração e verificação.
- [ ] Apresentar o plano consolidado e obter aprovação antes da implementação.

Só solicitar caminhos de projetos externos ou do vault quando forem necessários
para uma etapa aprovada. Não inspecionar GameDev com base no exemplo anterior.

## 2. Etapas candidatas

### Etapa 0 — documentação e entrada do assistente

Estrutura, contexto, decisões, instruções e limites documentados.
Essa foi a única etapa autorizada até o momento.

### Etapa 1 — fechamento do plano

Resolver as questões bloqueadoras e produzir um desenho de interface, contrato
de dados, arquitetura e critérios de aceite. Não instalar dependências nem
executar operações no serviço ou nos projetos reais para antecipar essa etapa.
A Rodada 1 foi fechada com D12 e D13; a Rodada 2 está em andamento.

### Etapa 2 — protótipo visual com dados simulados

Validar aparência, animações, navegação, popup e estados persistentes sem acesso
a projetos, chats ou vault reais.

### Etapa 3 — integração somente leitura

Validar o contrato V2 da instalação autorizada, conexão com serviço já existente,
listagem de sessões, diretórios e worktrees, estados ao vivo e reconexão.
Caso seja necessário iniciar um serviço, solicitar autorização antes.

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
- [ ] Reconexão recompõe o estado atual sem depender de eventos perdidos.
- [ ] Credenciais e conteúdo privado não aparecem no cliente ou em logs indevidos.
- [ ] Blob Office, vault e projetos anteriores permanecem inalterados.

## 4. Limites do primeiro escopo

Não foram solicitados merge automático, commits, execução autônoma de tarefas,
remoção de worktrees, sincronização de conversas ou migração de projetos.

Recursos adicionais exigem discussão e autorização próprias; não devem entrar
na implementação apenas por serem tecnicamente possíveis.
