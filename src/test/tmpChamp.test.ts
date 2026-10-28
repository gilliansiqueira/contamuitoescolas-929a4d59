import { test } from 'vitest'; import fs from 'fs';
import { buildImported, mergeRows } from '@/lib/renewal/mergeEngine';
test('x', () => {
  const t = JSON.parse(fs.readFileSync('/tmp/rp/t.json','utf8')); const c = JSON.parse(fs.readFileSync('/tmp/rp/c.json','utf8'));
  const rows = JSON.parse(fs.readFileSync('/tmp/rp/rows.json','utf8')); const sheet = JSON.parse(fs.readFileSync('/tmp/rp/sheet.json','utf8'));
  const st = fs.readFileSync('/tmp/rp/set.json','utf8').trim(); const settings = st ? JSON.parse(st) : {};
  const { rows: imp } = buildImported(t, c, { settings, minDue: sheet.params?.minDue } as any);
  const v=[...imp.values()]; console.log('imp', v.length, 'semprof', v.filter((r:any)=>!r.professor).length);
  const m = mergeRows(rows.filter((r:any)=>!r.manual), imp, sheet.columns);
  console.log('merged', m.rows.length, m.rows.filter((r:any)=>!r.imported.professor).length, JSON.stringify(m.stats).slice(0,300));
});
