// Detecta arquivo de turmas que provavelmente é de outra escola, antes de gravar.
export const normMat = (v: unknown) => String(v ?? '').trim().split('/')[0].replace(/^0+/, '').toLowerCase();

export interface SchoolGuardResult { suspicious: boolean; overlap: number; otherSchool?: { name: string; share: number } }

/**
 * fileMats: matrículas do arquivo; currentMats: matrículas da planilha atual;
 * others: matrículas encontradas nas planilhas de outras escolas (por escola).
 * Suspeito se a planilha atual tem >= 20 alunos e < 20% do arquivo bate com ela,
 * ou se > 80% do arquivo bate com outra escola.
 */
export function checkSchoolMismatch(fileMats: string[], currentMats: string[], others: { name: string; mats: string[] }[] = []): SchoolGuardResult {
  const file = new Set(fileMats.map(normMat).filter(Boolean));
  if (!file.size) return { suspicious: false, overlap: 1 };
  const cur = new Set(currentMats.map(normMat).filter(Boolean));
  const hit = [...file].filter(m => cur.has(m)).length;
  const overlap = hit / file.size;
  let otherSchool: SchoolGuardResult['otherSchool'];
  for (const o of others) {
    const s = new Set(o.mats.map(normMat));
    const share = [...file].filter(m => s.has(m)).length / file.size;
    if (share > 0.8 && (!otherSchool || share > otherSchool.share)) otherSchool = { name: o.name, share };
  }
  const suspicious = (cur.size >= 20 && overlap < 0.2) || !!otherSchool;
  return { suspicious, overlap, otherSchool };
}
