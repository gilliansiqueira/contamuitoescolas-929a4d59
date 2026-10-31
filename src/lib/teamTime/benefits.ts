/** Benefícios (VR/VT) e PIX da equipe — regras puras, sem acesso ao banco. */
import { isNationalHoliday } from './holidays';

const cents = (n: number) => Math.round(n * 100 + 1e-9) / 100;

/** Dias úteis do mês: seg–sex sem feriados nacionais; com desligamento, só os dias antes dele. */
export function businessDays(month: string, desligadoEm?: string | null): string[] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const wd = new Date(`${iso}T12:00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6 || isNationalHoliday(iso)) continue;
    if (desligadoEm && iso >= desligadoEm) continue;
    out.push(iso);
  }
  return out;
}

export interface BenefitInput {
  diasUteis: number;        // dias úteis do mês (ou até o desligamento)
  ausencias: number;        // faltas de dia inteiro + atestados em dias úteis
  vrDiario: number | null;
  vtDiario: number;         // R$ 12 por padrão
  recebeVt: boolean;
  vtCartao: boolean;
  liquido: number | null;   // líquido do holerite
}

/** VR = diário × dias trabalhados; VT = diário × dias trabalhados; PIX = líquido + VR + VT (VT fora se for no cartão). */
export function computeBenefits(i: BenefitInput) {
  const dias = Math.max(0, i.diasUteis - i.ausencias);
  const vr = i.vrDiario ? cents(i.vrDiario * dias) : 0;
  const vt = i.recebeVt ? cents(i.vtDiario * dias) : 0;
  const pix = cents((i.liquido ?? 0) + vr + (i.vtCartao ? 0 : vt));
  return { dias, vr, vt, pix };
}
