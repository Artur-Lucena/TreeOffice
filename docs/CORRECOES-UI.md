# Correções da UI — 13/10/2026

Escopo autorizado: arrasto dos nós com repulsão, visual giz-cassino mais vivo
e naipes visíveis. Não criar sessões reais, ligar MCPs, instalar pacotes,
apagar a árvore do usuário ou modificar OpenCode, vault e projetos externos.

## Verificação desta entrega

- [x] Ler contexto, decisões, planejamento e segurança; preservar mudanças pendentes.
- [x] Investigar raio físico versus desenho, relógio da animação e escolha de papel.
- [x] Reproduzir regressões com testes de gesto, zoom e desenho.
- [x] Corrigir arrasto, cancelamento e separação física nos tamanhos reais.
- [x] Mostrar e permitir escolher naipes como metadados locais, sem automação.
- [x] Corrigir recência/transições e respeitar efeitos desligados/movimento reduzido.
- [x] Validar no navegador real com perfil e árvore descartáveis.
- [x] Rodar todas as suítes e revisar diff.
- [ ] Publicar somente os arquivos desta entrega.

## Causas reproduzidas

- Raio físico multiplicado pelo zoom e menor que o blob que cresce/respira:
  a mola anulava a repulsão em ramos densos. O teste de dois níveis agora
  exige separação real; não foi trocado por um cenário mais fácil.
- Arrasto não tratava cancelamento e o teste antigo alterava estado interno,
  sem passar pelos handlers. Agora os testes usam eventos e mouse real.
- Naipes sumiam com zoom baixo; novos nós eram sempre `livre`, sem campo
  para selecionar papel. Foram acrescentados tamanho mínimo, legenda visível
  e seleção de metadado local. Nenhum papel existente foi trocado automaticamente.
- Recência comparava `Date.now()` com o tempo do RAF (relógios diferentes):
  nós dormentes nunca murchavam. O cálculo agora usa o relógio de época e
  suaviza o tamanho entre estados.
- Carimbo buscava Git na pasta de dados descartável, não nos fontes,
  imprimindo `fatal: not a git repository`. Agora identifica commit + digest
  da UI, sem depender da raiz de dados.

## Evidência

Executado no Windows, Node v24.19.0 e Edge headless já instalado:

- `node tests/smoke.mjs`: 45 verificações.
- `node tests/tree-render.mjs`: 50 verificações; incluem contornos, não apenas arcos.
- `node tests/opencode-client.mjs`: 27 verificações contra serviço falso.
- `node tests/browser-ui.mjs`: 14 verificações em Chromium real, passando
  pelos cookies, Canvas, popup, escolha de naipe, mouse, repulsão e pan.

Capturas e perfil isolado ficam em `.local/testes-ui/`, ignorado pelo Git.
Nenhum teste desta entrega liga ao OpenCode real. A aparência continua
sujeita ao reteste do usuário; rótulos e territórios dos grupos não têm colisão.

## Referências utilizadas como ideias, sem copiar código

- [force-graph](https://github.com/vasturiano/force-graph): arrasto que movimenta
  vizinhos, tamanho dos nós e partículas direcionais.
- [AI Agent Session Center](https://github.com/coding-by-feng/ai-agent-session-center):
  feedback visual de atividade, sem importar terminal, automação ou stack.
- Composição `lighter` aproxima halos; **não** implementa metaballs/marching
  squares nem transforma dependência visual em fluxo real de trabalho.
