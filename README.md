# TreeOffice

Integração visual com o OpenCode para organizar e criar chats em uma árvore
orgânica, dinâmica e animada, inspirada no Blob Office.

**Estado atual:** estrutura inicial e documentação. O plano ainda precisa ser
fechado com o usuário; não há aplicação implementada ou executável.

## Começar pelo assistente do projeto

Abra o OpenCode nesta pasta:

```powershell
Set-Location 'D:\Meus Projetos\TreeOffice'
opencode.cmd
```

Selecione o agente **Plan** e envie:

> Leia AGENTS.md e CONTEXTO-PROJETO.md. Assuma a liderança do planejamento do
> TreeOffice. Revise docs/DECISOES.md, docs/PLANEJAMENTO.md e docs/SEGURANCA.md.
> Continue fechando o plano comigo, sem implementar funcionalidades ou alterar
> o OpenCode, o Tucofre ou os projetos acompanhados.

O uso de `opencode.cmd` evita depender da execução de scripts `.ps1` no
PowerShell. Este projeto não altera a política de execução do Windows.

## Documentação

- [AGENTS.md](AGENTS.md): instruções de entrada para assistentes do projeto.
- [CONTEXTO-PROJETO.md](CONTEXTO-PROJETO.md): histórico, requisitos e limites.
- [docs/DECISOES.md](docs/DECISOES.md): decisões confirmadas e propostas abertas.
- [docs/PLANEJAMENTO.md](docs/PLANEJAMENTO.md): perguntas, etapas e critérios de aceite.
- [docs/SEGURANCA.md](docs/SEGURANCA.md): proteção dos projetos existentes.

## Estrutura

```text
TreeOffice/
├── AGENTS.md
├── CONTEXTO-PROJETO.md
├── README.md
├── .gitignore
├── docs/
│   ├── DECISOES.md
│   ├── PLANEJAMENTO.md
│   └── SEGURANCA.md
├── src/       # código futuro; arquitetura ainda não escolhida
├── tests/     # testes futuros, inicialmente com dados simulados
├── assets/    # recursos visuais próprios do TreeOffice
└── scripts/   # automações futuras, sempre explícitas
```

As pastas reservadas contêm apenas `.gitkeep`. Não foram instaladas dependências,
criados chats ou worktrees, inicializado um repositório Git, nem alteradas
configurações do OpenCode. A estrutura não fixa framework ou gerenciador de pacotes.

Todo o código e a documentação do TreeOffice permanecem em
`D:\Meus Projetos\TreeOffice`. Os projetos que futuramente aparecerem no painel
não precisam ser movidos para esta pasta.
