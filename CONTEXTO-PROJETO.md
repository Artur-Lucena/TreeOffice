# TreeOffice — contexto do projeto

## 1. Objetivo e localização

Criar uma integração visual com o OpenCode para ver, organizar e criar chats
conectados em uma árvore orgânica, dinâmica e animada, semelhante ao Blob Office.

O painel deverá ajudar o usuário a acompanhar conversas, responsabilidades,
worktrees, evidências e dependências sem interferir nos projetos atuais.

Pasta-mãe do projeto: **`D:\Meus Projetos\TreeOffice`**.

Todo o código, documentação, recursos e testes do TreeOffice devem permanecer
nessa pasta. Projetos externos exibidos pelo painel continuam onde já estão.

## 2. Estado atual

A estrutura e a documentação inicial foram autorizadas e criadas. A aplicação
não foi implementada e o plano completo ainda não foi aprovado.

A Rodada 1 do fechamento foi concluída: D12 (aplicação local independente com
ponte local), D13 (a conversa continua na interface do OpenCode na V1) e D14
(cadastro explícito de pastas e projetos). A Rodada 2, sobre organização e
aparência da árvore, está em andamento.

O usuário autorizou publicar a documentação no repositório
`https://github.com/Artur-Lucena/TreeOffice`. Nenhuma dependência foi
instalada, nenhum chat ou worktree foi criado e nenhuma configuração global do
OpenCode ou projeto externo foi alterada.

O usuário iniciará um novo chat nesta pasta para conduzir o restante do
planejamento. A montagem da estrutura não autoriza implementar funcionalidades.

## 3. Referência existente inspecionada

Foram lidos os arquivos:

- `C:\Users\Tuco\.config\opencode\plugins\blob-office.html`.
- `C:\Users\Tuco\.config\opencode\plugins\blob-office.ts`.
- `C:\Users\Tuco\.config\opencode\plugins\blob-office-INSTALL-NOTES.md`.

O Blob Office utiliza p5.js e um WebSocket em `ws://localhost:2727/ws` para
representar a atividade de sessões com blobs animados.

Ele é um visualizador passivo: não oferece controles para criar chats ou
gerenciar worktrees. Seu estado visual é temporário e certos agentes são
removidos da visualização após inatividade.

O TreeOffice deve funcionar separadamente e preservar essa instalação.
Não foi copiado código do Blob Office para o projeto.

A versão consultada pelo comando `opencode.cmd --version` foi `v2.0.26`.
A documentação pública V2 oferece operações para sessões e worktrees, mas
essas operações não foram testadas contra o serviço local neste planejamento.

## 4. Aparência e interação confirmadas

- Árvore orgânica e animada, não um diagrama estático de caixas.
- Linguagem visual semelhante ao Blob Office.
- Cada chat é um blob associado a um galho.
- Ao criar uma ramificação, o novo galho aparece com animação.
- O movimento e a aparência dos blobs refletem o estado de atividade.
- Chats parados ou concluídos permanecem visíveis.

Zoom, arrastar a árvore, recolher ramificações e transições estáveis foram
propostos como recursos de navegação. O desenho detalhado ainda será fechado.

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
O tratamento de tentativas de compartilhar pasta ainda é uma decisão aberta:
nunca permitir mistura de alterações silenciosamente.

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
Conexões pontilhadas opcionais para dependências foram propostas, mas o modelo
e o desenho dessas relações ainda precisam ser aprovados.

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

## 9. Direção técnica proposta, não definitiva

- Painel web local separado do Blob Office.
- p5.js como candidato para preservar a linguagem visual da referência.
- Integração com o serviço OpenCode usando a API V2.
- Ponte local para manter credenciais fora do navegador.
- Persistência própria de vínculos e preferências visuais.
- Leitura de sessões existentes antes de habilitar operações de escrita.
- Recuperação do estado após desconexões, sem depender apenas de eventos.
- Credenciais, histórico e caminhos tratados como dados privados.

D12 fixou aplicação local independente com ponte local como base; plugin V2
fica fora da arquitetura inicial. Não há framework, gerenciador de pacotes ou
porta definidos.

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

## 11. Próxima etapa

O próximo assistente deve ler o registro de decisões, revisar as questões
abertas e continuar o planejamento com o usuário, seguindo a ordem de rodadas
descrita em `docs/DECISOES.md`. Não tratar as propostas técnicas como
arquitetura aprovada nem começar a implementação por iniciativa própria.

Documentos complementares:

- [Decisões](docs/DECISOES.md).
- [Planejamento](docs/PLANEJAMENTO.md).
- [Segurança](docs/SEGURANCA.md).

## 12. Referências técnicas

- [Plugins V2](https://opencode.ai/v2/docs/build/plugins).
- [Cliente V2](https://opencode.ai/v2/docs/build/client).
- [API V2](https://opencode.ai/v2/docs/api).
- [OpenAPI público V2](https://opencode.ai/v2/openapi.json).
- [Instruções e AGENTS.md](https://opencode.ai/v2/docs/instructions).

Reconsultar a documentação e verificar a instalação na etapa apropriada;
essas referências não substituem validação de compatibilidade local.
