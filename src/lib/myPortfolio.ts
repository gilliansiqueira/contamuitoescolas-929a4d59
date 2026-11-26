/** "Minha carteira": escolas em que a pessoa é responsável ou que são de colegas que ela supervisiona. */
export function isInMyPortfolio(responsibleUserId: string | null | undefined, myUserId: string | null | undefined, supervisedIds: readonly string[] = []): boolean {
  if (!responsibleUserId || !myUserId) return false;
  return responsibleUserId === myUserId || supervisedIds.includes(responsibleUserId);
}
