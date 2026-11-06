import { DOCUMENTOS_PLANILHA, type AlunoPlanilha } from "@/lib/planilha-alunos";
import { encontrarAlunoDuplicado } from "@/lib/duplicidade";

export const MOTIVOS_REVISAO = ["Contato ausente", "Nascimento ausente", "Documentos não anexados", "Possível duplicidade"] as const;
export type MotivoRevisao = (typeof MOTIVOS_REVISAO)[number];

export function revisarCadastros<T extends AlunoPlanilha>(alunos: T[]) {
  return alunos.map((aluno) => {
    const motivos: MotivoRevisao[] = [];
    if (!aluno.telefone?.trim() && !aluno.telefone2?.trim() && !aluno.email?.trim()) motivos.push("Contato ausente");
    if (!aluno.data_nascimento) motivos.push("Nascimento ausente");
    const documentos = DOCUMENTOS_PLANILHA.filter((doc) =>
      (doc.campo !== "doc_matricula_path" || Boolean(aluno.escola?.trim())) && !aluno[doc.campo],
    ).map((doc) => doc.rotulo);
    if (documentos.length) motivos.push("Documentos não anexados");
    const duplicado = encontrarAlunoDuplicado(aluno, alunos, aluno.id);
    if (duplicado) motivos.push("Possível duplicidade");
    return { aluno, motivos, documentos, duplicado };
  }).filter((item) => item.motivos.length > 0);
}