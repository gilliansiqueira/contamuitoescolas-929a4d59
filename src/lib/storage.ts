import { AppData, FinancialEntry, School, ExclusionRule, SimulationScenario, MonthlyClosing, UploadRecord } from '@/types/financial';

const STORAGE_KEY = 'projecao_financeira_data';

function getAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (!data.uploads) data.uploads = [];
      return data;
    }
  } catch {}
  return { schools: [], entries: [], rules: [], scenarios: [], closings: [], uploads: [] };
}

function saveAppData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Schools
export function getSchools(): School[] {
  return getAppData().schools;
}

export function addSchool(school: School) {
  const data = getAppData();
  data.schools.push(school);
  saveAppData(data);
}

export function updateSchool(school: School) {
  const data = getAppData();
  const idx = data.schools.findIndex(s => s.id === school.id);
  if (idx >= 0) data.schools[idx] = school;
  saveAppData(data);
}

export function deleteSchool(schoolId: string) {
  const data = getAppData();
  data.schools = data.schools.filter(s => s.id !== schoolId);
  data.entries = data.entries.filter(e => e.school_id !== schoolId);
  data.rules = data.rules.filter(r => r.school_id !== schoolId);
  data.scenarios = data.scenarios.filter(s => s.school_id !== schoolId);
  data.closings = data.closings.filter(c => c.school_id !== schoolId);
  data.uploads = data.uploads.filter(u => u.school_id !== schoolId);
  saveAppData(data);
}

export function getSaldoInicial(schoolId: string): number {
  const school = getAppData().schools.find(s => s.id === schoolId);
  return school?.saldoInicial ?? 0;
}

export function setSaldoInicial(schoolId: string, valor: number) {
  const data = getAppData();
  const school = data.schools.find(s => s.id === schoolId);
  if (school) {
    school.saldoInicial = valor;
    saveAppData(data);
  }
}

// Entries
export function getEntries(schoolId: string): FinancialEntry[] {
  return getAppData().entries.filter(e => e.school_id === schoolId);
}

export function addEntries(entries: FinancialEntry[]) {
  const data = getAppData();
  data.entries.push(...entries);
  saveAppData(data);
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

export function deleteEntriesByUploadId(uploadId: string) {
  const data = getAppData();
  data.entries = data.entries.filter(e => e.origem_upload_id !== uploadId);
  saveAppData(data);
}

// Rules
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

// Scenarios
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

// Closings
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

// Uploads
export function getUploads(schoolId: string): UploadRecord[] {
  return getAppData().uploads.filter(u => u.school_id === schoolId);
}

export function addUpload(upload: UploadRecord) {
  const data = getAppData();
  data.uploads.push(upload);
  saveAppData(data);
}

export function deleteUpload(uploadId: string) {
  const data = getAppData();
  data.uploads = data.uploads.filter(u => u.id !== uploadId);
  data.entries = data.entries.filter(e => e.origem_upload_id !== uploadId);
  saveAppData(data);
}

// Export/Import
export function exportAllData(): string {
  return JSON.stringify(getAppData(), null, 2);
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json) as AppData;
    if (!data.schools || !data.entries) return false;
    if (!data.uploads) data.uploads = [];
    saveAppData(data);
    return true;
  } catch {
    return false;
  }
}
