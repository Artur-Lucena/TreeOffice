/** Ramificação puramente visual: não cria sessão nem worktree. */
export function criarRamoDaConexao(estado, arvoreLocal, info, titulo, papel) {
  const ponto=arvoreLocal.pontoConexao(info.id,info.t);
  if (!ponto) throw new Error("Esta conexão não está mais disponível.");
  const id=globalThis.crypto?.randomUUID?.() || `ramo-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const no={id,titulo:titulo.trim(),papel,grupoPai:info.para,
    estado:"vazio",simulado:true,recolhido:false,
    conexaoPai:{id:info.id,t:info.t},
    posicao:{x:ponto.x+ponto.nx*160,y:ponto.y+ponto.ny*160},
    posicaoFixada:true,
  };
  if (!no.titulo) throw new Error("Informe o nome do novo módulo.");
  estado.nos.push(no);
  arvoreLocal.definirEstado(estado);
  return no;
}

