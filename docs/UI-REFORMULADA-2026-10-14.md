# UI reformulada e aplicada — 14/10/2026

O usuário aprovou aplicar ao TreeOffice e enviar ao GitHub as melhorias avaliadas nas prévias desta conversa. D54–D57 substituem os comportamentos visuais anteriores que entravam em conflito com essa aprovação.

## Comportamento

- UI minimalista com paleta preservada, Amarante em títulos e Manrope nos controles. As fontes e suas licenças OFL ficam em `src/ui/assets/fonts`; não há CDN em execução.
- Explorador pesquisável, naipes estampados no centro dos módulos e inspetor mostrado ao selecionar um módulo ou fio. Layout adapta-se a telas menores.
- Arrasto com deslizamento até o cursor, colisão entre corpos e centro do grupo acompanhando os membros. Soltar não devolve o módulo à posição original.
- Organização salva em `.local/state.json` após o gesto estabilizar. `posicaoFixada` distingue organização explícita de posições vazias do esquema antigo. Salvamentos são serializados e referências do painel são atualizadas depois da normalização.
- Fios uniformes e selecionáveis, inclusive pela lista acessível no explorador. Informações mostram origem, destino e tipo; nome e notas são metadados digitados pelo usuário.
- Ramificação visual a partir do ponto escolhido no fio. `conexaoPai` preserva a posição paramétrica: o vínculo acompanha a curva quando seus módulos mudam. Referências órfãs/cíclicas são degradadas com aviso na normalização.
- Diálogos arrastáveis pelo cabeçalho, limitados à área da aplicação, com movimento amortecido. Entradas/saídas de diálogos e painéis, etapas do popup, menus e recolhimento de galhos têm transições. Reabertura cancela a saída anterior. Movimento reduzido e efeitos desligados são respeitados.
- Botões de criar ramificação e salvar informações têm handlers diretos de clique, validação e proteção contra clique duplo. Dependências e remoção usam diálogos da própria UI.

## Escopo e referências

A renderização continua Canvas 2D, JavaScript e CSS puros, sem build ou dependência nova de runtime. Animate UI foi referência de comportamento, sem instalar o MCP ou os componentes React:

- https://animate-ui.com/docs/mcp
- https://animate-ui.com/docs/primitives/radix/dialog
- https://animate-ui.com/docs/primitives/radix/sheet
- https://animate-ui.com/docs/accessibility

A ponte e suas proteções de token/origem/host permanecem. A integração com OpenCode é somente leitura. Criar módulos/ramificações não cria sessões, branches ou worktrees reais. O fluxo original de novo chat conserva a pergunta sobre isolamento. Nenhum projeto externo, vault ou árvore pessoal foi usado como fixture.

## Validação

Suítes reproduzíveis sem instalar pacotes:

- `node tests/smoke.mjs`: 51 verificações (inclui fontes locais e ida/volta dos metadados pela API e pelo disco).
- `node tests/tree-render.mjs`: 55 verificações; expectativas de retorno à âncora e partículas foram substituídas pelos comportamentos aprovados.
- `node tests/tree-interactions.mjs`: 23 verificações de gestos reais via handlers, fios selecionáveis, ramificações, transições e restauração de posições.
- `node tests/visual-state.mjs`: 12 verificações de normalização/persistência e reparo de referências.
- `node tests/navigation.mjs`: 8 verificações.
- `node tests/opencode-client.mjs`: 27 verificações contra serviço HTTP falso.

Durante a aplicação, a UI completa também passou por 69 verificações de eventos em DOM simulado usando a normalização real da ponte, e 16 verificações adicionais das animações/arrasto dos diálogos em simulador de Web Animations. Esse harness temporário não é uma dependência do projeto e não substitui avaliação visual no navegador.

A suíte `browser-ui` foi atualizada para o arrasto livre, mas não foi executada neste ambiente: o navegador disponível não alcança a ponte local. Não foi testado um serviço OpenCode real. Sintaxe dos módulos, IDs do HTML e diff são conferidos antes do commit.

**Adendo em 14/10/2026 (Windows):** a `browser-ui` foi executada aqui, em Edge headless com perfil e árvore descartáveis: **14 ok, 0 falhas**. Uma expectativa estava defasada da era D49 (título com sufixo de naipe); com D54 o naipe é estampa central separada, e o teste agora confere título + estampa `♣` no mesmo centro (`tests/browser-ui.mjs`). Total do projeto nesta data: **190 verificações verdes**.
