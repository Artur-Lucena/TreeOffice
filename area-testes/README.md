# Área de testes descartável (Fase C)

Nada nesta pasta entra no Git, exceto este aviso.

- `demo/` é um repositório Git descartável, criado só para validar vinculação
  e criação de worktrees pela ponte, sem tocar em projetos reais (D26).
- Pode ser apagado e recriado a qualquer momento. Nunca aponte o painel para
  fora desta pasta durante testes de escrita.
- Identidade de commit local daqui (`teste-treeoffice`) é fictícia e gravada
  com `-c`, sem alterar a configuração global do Git.
