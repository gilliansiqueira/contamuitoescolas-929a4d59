const words = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).filter(Boolean);

const isSubsequence = (short: string[], long: string[]) => {
  let i = 0;
  for (const w of long) if (i < short.length && w === short[i]) i++;
  return i === short.length;
};

/** Junta nome curto ("Raissa Souza") ao único nome completo compatível ("Raissa Tavares de Souza"): mesmo primeiro nome e palavras na mesma ordem. Em dúvida, não junta. */
export function canonicalProfessors(names: (string | null | undefined)[]): Map<string, string> {
  const uniq = [...new Set(names.map(n => String(n ?? '').trim()).filter(Boolean))];
  const out = new Map<string, string>();
  for (const n of uniq) {
    const w = words(n);
    const cands = uniq.filter(o => {
      if (o === n) return false;
      const ow = words(o);
      return ow.length > w.length && ow[0] === w[0] && isSubsequence(w, ow);
    });
    // escolhe o mais completo; só se todos os candidatos forem compatíveis entre si (um contido no outro)
    if (!cands.length) continue;
    const best = cands.sort((a, b) => words(b).length - words(a).length)[0];
    if (cands.every(c => c === best || isSubsequence(words(c), words(best)))) out.set(n, best);
  }
  return out;
}
