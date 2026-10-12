# TreeOffice

Integração visual com o OpenCode para organizar e criar chats em uma árvore
orgânica, dinâmica e animada, inspirada no Blob Office.

**Estado atual:** plano de design fechado em 12/10/2026, após sete rodadas de
decisão. O protótipo visual da Etapa 2 existe em `src/` (Node puro, sem
dependências, dados simulados) e aguarda sua avaliação para confirmar ou
descartar a p5.js (D19). A integração com o OpenCode (Etapas 3 em diante)
depende de autorização do usuário (D11). Roadmap de execução em
[docs/ROADMAP-V1.md](docs/ROADMAP-V1.md).

## Requisitos

- **Node 18.2+** (20/22 LTS recomendado) para executar ou testar o protótipo.
- Windows ou Linux: comandos e caminhos na documentação são portáteis (D43).

## Documentação

- [AGENTS.md](AGENTS.md): instruções de entrada para assistentes do projeto.
- [CONTEXTO-PROJETO.md](CONTEXTO-PROJETO.md): histórico, requisitos e limites.
- [docs/DECISOES.md](docs/DECISOES.md): decisões confirmadas (D01–D44) e propostas abertas.
- [docs/PLANEJAMENTO.md](docs/PLANEJAMENTO.md): rodadas de decisão, etapas e critérios de aceite.
- [docs/SEGURANCA.md](docs/SEGURANCA.md): proteção dos projetos existentes.
- [docs/PESQUISA.md](docs/PESQUISA.md): pesquisa de referência, ecossistema e verificações pendentes.
- [docs/PLANO-CONSOLIDADO.md](docs/PLANO-CONSOLIDADO.md): arquitetura, contrato de dados, etapas e critérios de aceite.
- [docs/ROADMAP-V1.md](docs/ROADMAP-V1.md): roadmap de execução da V1 em fases A–F, com portões e autorizações.
- [src/README.md](src/README.md): como executar e verificar o protótipo.

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
│   ├── PLANO-CONSOLIDADO.md
│   └── ROADMAP-V1.md         # roadmap de execução da V1
├── src/       # protótipo da Etapa 2 (Node puro, dados simulados)
├── tests/     # smoke test do protótipo; demais testes virão nas próximas etapas
├── assets/    # recursos visuais próprios do TreeOffice
└── scripts/   # automações futuras, sempre explícitas
```

`assets/` e `scripts/` contêm apenas `.gitkeep`. Nenhuma dependência foi
instalada, nenhum chat ou worktree foi criado e nenhuma configuração do
OpenCode ou projeto externo foi alterada. O estado de execução do painel fica
em `.local/`, fora do versionamento.

O código e a documentação do TreeOffice permanecem na pasta deste repositório —
originalmente `D:\Meus Projetos\TreeOffice` no Windows, e, desde 12/10/2026,
também clonada no Linux (D43). Os projetos que futuramente aparecerem no painel
não precisam ser movidos para esta pasta.
