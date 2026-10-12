# TreeOffice

Integração visual com o OpenCode para organizar e criar chats em uma árvore
orgânica, dinâmica e animada, inspirada no Blob Office.

**Estado atual:** plano de design fechado em 12/10/2026, após sete rodadas de
decisão. Nenhuma funcionalidade foi implementada; a implementação depende de
autorização do usuário (D11).

## Documentação

- [AGENTS.md](AGENTS.md): instruções de entrada para assistentes do projeto.
- [CONTEXTO-PROJETO.md](CONTEXTO-PROJETO.md): histórico, requisitos e limites.
- [docs/DECISOES.md](docs/DECISOES.md): decisões confirmadas (D01–D42) e propostas abertas.
- [docs/PLANEJAMENTO.md](docs/PLANEJAMENTO.md): rodadas de decisão, etapas e critérios de aceite.
- [docs/SEGURANCA.md](docs/SEGURANCA.md): proteção dos projetos existentes.
- [docs/PESQUISA.md](docs/PESQUISA.md): pesquisa de referência, ecossistema e verificações pendentes.
- [docs/PLANO-CONSOLIDADO.md](docs/PLANO-CONSOLIDADO.md): arquitetura, contrato de dados, etapas e critérios de aceite.

A documentação é mantida no repositório privado
<https://github.com/Artur-Lucena/TreeOffice>.

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
│   ├── SEGURANCA.md
│   ├── PESQUISA.md
│   └── PLANO-CONSOLIDADO.md
├── src/       # código futuro; arquitetura definida, não implementada
├── tests/     # testes futuros, inicialmente com dados simulados
├── assets/    # recursos visuais próprios do TreeOffice
└── scripts/   # automações futuras, sempre explícitas
```

As pastas reservadas contêm apenas `.gitkeep`. Não foram instaladas dependências,
criados chats ou worktrees, nem alteradas configurações do OpenCode ou projetos
externos. A arquitetura está decidida (aplicação local independente com ponte
local), mas nenhuma linha de código existe ainda.

Todo o código e a documentação do TreeOffice permanecem em
`D:\Meus Projetos\TreeOffice`. Os projetos que futuramente aparecerem no painel
não precisam ser movidos para esta pasta.
