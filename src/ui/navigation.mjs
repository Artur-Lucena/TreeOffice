/** Deriva uma navegação local; nunca lê diretórios nem modifica o estado. */
export function organizarNavegacao(state, consulta = "") {
  const grupos = state?.grupos || [];
  const nos = state?.nos || [];
  const porId = new Map(nos.map((no) => [no.id, no]));
  const grupoIds = new Set(grupos.map((grupo) => grupo.id));
  const normalizar = (valor) => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const termo = normalizar(consulta.trim());
  const secoes = grupos.map((grupo) => ({ grupo, itens: [] }));
  const semGrupo = { grupo: { id: null, titulo: "Sem grupo" }, itens: [] };

  for (const no of nos) {
    let pai = no.grupoPai;
    let profundidade = 0;
    const vistos = new Set([no.id]);
    while (pai && porId.has(pai) && !vistos.has(pai)) {
      vistos.add(pai);
      pai = porId.get(pai).grupoPai;
      profundidade += 1;
    }
    const secao = grupoIds.has(pai) ? secoes.find((item) => item.grupo.id === pai) : semGrupo;
    if (!termo || normalizar(no.titulo).includes(termo) || normalizar(secao.grupo.titulo).includes(termo)) {
      secao.itens.push({ no, profundidade: secao === semGrupo ? 0 : profundidade });
    }
  }

  if (semGrupo.itens.length) secoes.push(semGrupo);
  return secoes.filter((secao) => !termo || secao.itens.length || normalizar(secao.grupo.titulo).includes(termo));
}
