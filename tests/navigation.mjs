import assert from "node:assert/strict";
import { organizarNavegacao } from "../src/ui/navigation.mjs";

const state = {
  grupos: [{ id: "g", titulo: "Coordenação" }],
  nos: [
    { id: "pai", titulo: "Revisar plano", grupoPai: "g" },
    { id: "filho", titulo: "Investigar sessão", grupoPai: "pai" },
    { id: "solto", titulo: "Sem vínculo", grupoPai: null },
    { id: "orfao", titulo: "Pai ausente", grupoPai: "faltante" },
    { id: "ciclo-a", titulo: "Ciclo A", grupoPai: "ciclo-b" },
    { id: "ciclo-b", titulo: "Ciclo B", grupoPai: "ciclo-a" },
  ],
};
const antes = JSON.stringify(state);
const secoes = organizarNavegacao(state);
assert.equal(secoes[0].itens[1].profundidade, 1, "filho herda o grupo e sua profundidade");
assert.equal(secoes.flatMap((s) => s.itens).length, state.nos.length, "nenhum nó desaparece da navegação");
assert.equal(secoes[1].grupo.titulo, "Sem grupo", "nós órfãos e ciclos têm um destino visível");
assert.equal(organizarNavegacao(state, "  SESSAO  ")[0].itens[0].no.id, "filho", "busca ignora acentos, caixa e espaços");
assert.equal(organizarNavegacao(state, "COORDENACAO")[0].itens.length, 2, "nome do grupo encontra sua organização");
assert.equal(organizarNavegacao(state, "inexistente").length, 0, "busca sem resultado não inventa nós");
assert.equal(JSON.stringify(state), antes, "navegação não altera dados ou relações");
assert.deepEqual(organizarNavegacao(null), [], "estado ainda não carregado é aceito");
console.log("Navegação: 8 verificações passaram.");
