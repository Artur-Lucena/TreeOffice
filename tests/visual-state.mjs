/** Persistência visual sem acessar árvore pessoal ou serviço OpenCode. */
import assert from "node:assert/strict";
import { normalizeState, emptyState } from "../src/shared/model.mjs";
const entrada={...emptyState(),grupos:[{id:"g",titulo:"Grupo"}],nos:[
 {id:"a",grupoPai:"g",posicao:{x:321,y:-45},posicaoFixada:true},
 {id:"b",grupoPai:"a",conexaoPai:{id:"ramo:a",t:0.42}},
],conexoesInfo:{"ramo:a":{nome:"Entrega",notas:"Texto digitado pelo usuário"}}};
const salvo=normalizeState(entrada).state;
const reaberto=normalizeState(JSON.parse(JSON.stringify(salvo))).state;
assert.deepEqual(reaberto.nos[0].posicao,{x:321,y:-45});
assert.equal(reaberto.nos[0].posicaoFixada,true);
assert.deepEqual(reaberto.nos[1].conexaoPai,{id:"ramo:a",t:0.42});
assert.equal(reaberto.conexoesInfo["ramo:a"].nome,"Entrega");
assert.equal(reaberto.conexoesInfo["ramo:a"].notas,"Texto digitado pelo usuário");
assert.equal(normalizeState({...emptyState(),nos:[{id:"antigo",posicao:{x:0,y:0}}]}).state.nos[0].posicaoFixada,false);
const quebrado=structuredClone(entrada);quebrado.nos[1].conexaoPai.id="ramo:inexistente";
const reparado=normalizeState(quebrado);
assert.equal(reparado.state.nos[1].conexaoPai,null);
assert.ok(reparado.avisos.length>0);
const ciclico=structuredClone(entrada);ciclico.nos[0].conexaoPai={id:"ramo:b",t:0.5};
assert.ok(normalizeState(ciclico).avisos.some(a=>a.includes("cíclica")));
const limitado=structuredClone(entrada);limitado.conexoesInfo["ramo:a"]={nome:"x".repeat(200),notas:"y".repeat(2000)};
limitado.conexoesInfo["ramo:inexistente"]={nome:"Não deve sobreviver"};
const limpo=normalizeState(limitado).state;
assert.equal(limpo.conexoesInfo["ramo:a"].nome.length,80);
assert.equal(limpo.conexoesInfo["ramo:a"].notas.length,1000);
assert.equal(limpo.conexoesInfo["ramo:inexistente"],undefined);
console.log("12 verificações de persistência visual passaram.");
