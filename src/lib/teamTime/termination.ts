/** Dia conta no ponto só antes da data de desligamento (o próprio dia do desligamento não conta). */
export function beforeTermination(dia: string | undefined, desligadoEm: string | null | undefined) {
  return !dia || !desligadoEm || dia < desligadoEm;
}
