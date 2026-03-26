import { AppData, FinancialEntry, School, ExclusionRule, SimulationScenario, MonthlyClosing } from '@/types/financial';

const STORAGE_KEY = 'projecao_financeira_data';

function getAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { schools: [], entries: [], rules: [], scenarios: [], closings: [] };
}

function saveAppData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getSchools(): School[] {
  return getAppData().schools;
}

export function addSchool(school: School) {
  const data = getAppData();
  data.schools.push(school);
  saveAppData(data);
}

export function getEntries(schoolId: string): FinancialEntry[] {
  return getAppData().entries.filter(e => e.school_id === schoolId);
}

export function addEntries(entries: FinancialEntry[]) {
  const data = getAppData();
  data.entries.push(...entries);
  saveAppData(data);
}

export function getRules(schoolId: string): ExclusionRule[] {
  return getAppData().rules.filter(r => r.school_id === schoolId);
}

export function addRule(rule: ExclusionRule) {
  const data = getAppData();
  data.rules.push(rule);
  saveAppData(data);
}

export function deleteRule(ruleId: string) {
  const data = getAppData();
  data.rules = data.rules.filter(r => r.id !== ruleId);
  saveAppData(data);
}

export function getScenarios(schoolId: string): SimulationScenario[] {
  return getAppData().scenarios.filter(s => s.school_id === schoolId);
}

export function saveScenario(scenario: SimulationScenario) {
  const data = getAppData();
  const idx = data.scenarios.findIndex(s => s.id === scenario.id);
  if (idx >= 0) data.scenarios[idx] = scenario;
  else data.scenarios.push(scenario);
  saveAppData(data);
}

export function getClosings(schoolId: string): MonthlyClosing[] {
  return getAppData().closings.filter(c => c.school_id === schoolId);
}

export function addClosing(closing: MonthlyClosing) {
  const data = getAppData();
  const idx = data.closings.findIndex(c => c.school_id === closing.school_id && c.mes === closing.mes);
  if (idx >= 0) data.closings[idx] = closing;
  else data.closings.push(closing);
  saveAppData(data);
}

export function exportAllData(): string {
  return JSON.stringify(getAppData(), null, 2);
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json) as AppData;
    if (!data.schools || !data.entries) return false;
    saveAppData(data);
    return true;
  } catch {
    return false;
  }
}

export function deleteEntries(schoolId: string, origem?: string) {
  const data = getAppData();
  data.entries = data.entries.filter(e => {
    if (e.school_id !== schoolId) return true;
    if (origem && e.origem !== origem) return true;
    return false;
  });
  saveAppData(data);
}
