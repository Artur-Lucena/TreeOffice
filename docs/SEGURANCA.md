# Segurança e proteção dos projetos existentes

## Princípio: nenhuma surpresa operacional

Visualizar, selecionar ou organizar um nó não deve produzir alterações em
repositórios, sessões, configurações ou no Obsidian.

Separar leitura, alteração de vínculo visual e operações reais no OpenCode/Git.
Cada operação de escrita exige uma ação explícita com escopo compreensível.

## Repositórios e worktrees

- Não presumir que a pasta organizacional é a raiz de um repositório.
- Confirmar repositório, contexto do chat e diretório real antes de agir.
- Não trocar a branch de worktrees existentes.
- Não fazer commit, stash, reset, merge ou copiar arquivos como preparação implícita.
- Não tratar alterações não commitadas como automaticamente incluídas em um novo
  worktree. O comportamento deve ser explicado e decidido pelo usuário.
- Identificar worktrees já associados a chats de implementação e evitar mistura
  silenciosa de alterações.
- Respeitar a estratégia e a configuração do projeto; não substituí-las por
  configuração global do TreeOffice.

A criação pela API V2 pode executar scripts de preparação configurados pelo
projeto. Antes de habilitar essa ação, definir como identificar, apresentar e
autorizar esses efeitos. Não apresentar a operação como apenas criar uma pasta.

## Sessões e hierarquia visual

- Novos chats usam contexto novo, sem fork automático.
- Não modificar agente, modelo, permissões ou relações nativas de sessões existentes.
- Guardar os vínculos organizacionais separadamente.
- Excluir ou arquivar um vínculo visual não deve excluir uma sessão.
- A API pode excluir descendentes ao remover uma sessão; não utilizar exclusão
  nativa como mecanismo de organização da árvore.
- Em falhas parciais, informar quais recursos foram criados e pedir decisão.
  Não fazer limpeza destrutiva ou repetir a criação automaticamente.

## Serviço local e navegador

- Não copiar o modelo de WebSocket sem autenticação da referência para operações
  capazes de modificar projetos.
- Restringir a exposição à máquina local e autenticar as ações.
- Definir proteção contra chamadas de páginas externas e validar origem quando
  aplicável. Estar em localhost, sozinho, não basta.
- Manter credenciais de serviço fora do código e dos recursos do navegador.
- Não iniciar serviços ou abrir chats como efeito colateral de uma verificação.
- Não disputar a porta 2727 ou alterar o Blob Office sem autorização.
- Planejar reconexão e nova leitura do estado, pois eventos ao vivo não substituem
  inventário persistente nem garantem replay.

## Tucofre e privacidade

- O vault não está dentro da pasta-mãe do TreeOffice por definição.
- Solicitar apenas os caminhos necessários para a integração aprovada.
- Não varrer ou indexar todo o vault automaticamente.
- Não inserir notas ou instruções em chats sem escolha explícita.
- Não editar ou sincronizar registros automaticamente.
- Não colocar histórico de chats, notas privadas ou credenciais em fixtures,
  documentação, screenshots ou logs compartilhados.
- Documentar posteriormente retenção, localização e remoção de dados locais.

## Instalação e testes

- Código e documentação permanecem em `D:\Meus Projetos\TreeOffice`.
- Eventual configuração externa deve apontar para esse código e ser aprovada
  antes de qualquer alteração; não espalhar cópias do projeto.
- Não instalar dependências nos projetos acompanhados.
- Verificar licença antes de reutilizar código ou assets do Blob Office.
- Começar com dados simulados e repositórios descartáveis sob controle do projeto.
- Só testar contra projetos atuais depois de autorização específica.
- Não afirmar que a integração funciona com a instalação local apenas porque
  o endpoint consta da documentação pública.
