const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    env[k] = v;
  }
});

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const excelPath = 'C:\\Users\\USUARIO\\Downloads\\Fluxo de Caixa - fazenda.xlsx';

async function main() {
  if (!fs.existsSync(excelPath)) {
    console.error('Spreadsheet not found at path:', excelPath);
    return;
  }

  // 1. Create or Find School "Fazenda Rio Grande"
  console.log('Checking if school "Fazenda Rio Grande" exists...');
  let { data: school, error: err1 } = await supabase
    .from('schools')
    .select('*')
    .eq('nome', 'Fazenda Rio Grande')
    .maybeSingle();

  if (err1) {
    console.error('Error checking school:', err1);
    return;
  }

  if (!school) {
    console.log('School not found. Creating school "Fazenda Rio Grande"...');
    const { data: newSchool, error: err2 } = await supabase
      .from('schools')
      .insert({
        nome: 'Fazenda Rio Grande',
        saldo_inicial: 0,
        saldo_inicial_data: '2026-05-01'
      })
      .select()
      .single();

    if (err2) {
      console.error('Error creating school:', err2);
      return;
    }
    school = newSchool;
    console.log('School created:', school);
  } else {
    console.log('School already exists:', school);
  }

  const schoolId = school.id;

  // 2. Setup Type Classifications for this school
  const classifications = [
    { school_id: schoolId, tipo_valor: 'ignorar', label: 'Ignorar', classificacao: 'ignorar', entra_no_resultado: false, impacta_caixa: false, operacao_sinal: 'somar' },
    { school_id: schoolId, tipo_valor: 'despesas', label: 'Despesas', classificacao: 'despesa', entra_no_resultado: true, impacta_caixa: true, operacao_sinal: 'subtrair' },
    { school_id: schoolId, tipo_valor: 'receita real', label: 'Receita Real', classificacao: 'receita', entra_no_resultado: true, impacta_caixa: true, operacao_sinal: 'somar' },
    { school_id: schoolId, tipo_valor: 'transferencia entre contas', label: 'Transferência entre Contas', classificacao: 'operacao', entra_no_resultado: false, impacta_caixa: true, operacao_sinal: 'somar' },
    { school_id: schoolId, tipo_valor: 'antecipacao', label: 'Antecipação', classificacao: 'receita', entra_no_resultado: true, impacta_caixa: true, operacao_sinal: 'somar' },
    { school_id: schoolId, tipo_valor: 'pro-labore', label: 'Pró-Labore', classificacao: 'despesa', entra_no_resultado: true, impacta_caixa: true, operacao_sinal: 'subtrair' }
  ];

  console.log('Setting up type classifications...');
  for (const tc of classifications) {
    const { data: existing } = await supabase
      .from('type_classifications')
      .select('id')
      .eq('school_id', schoolId)
      .eq('tipo_valor', tc.tipo_valor)
      .maybeSingle();

    if (existing) {
      await supabase.from('type_classifications').update(tc).eq('id', existing.id);
    } else {
      await supabase.from('type_classifications').insert(tc);
    }
  }
  console.log('Type classifications set up successfully!');

  // 3. Load spreadsheet rows
  console.log('Loading spreadsheet data...');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Maio 2026'];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`Loaded ${rows.length} rows.`);

  // 4. Clean up any existing entries for this school to have a clean import
  console.log('Clearing existing entries for this school...');
  const { error: delErr } = await supabase
    .from('financial_entries')
    .delete()
    .eq('school_id', schoolId);
  if (delErr) {
    console.error('Error deleting entries:', delErr);
    return;
  }

  // 5. Convert and Insert rows in batches of 500
  console.log('Converting and inserting entries...');
  const entries = [];
  
  function parseDate(val) {
    if (!val) return '2026-05-01';
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    const s = String(val).trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return s;
  }

  rows.forEach((row, i) => {
    const val = Number(row[' Valor '] || row['Valor'] || 0);
    const cat = String(row['Categoria'] || '').trim();
    const desc = String(row['Observação / Empresa'] || '').trim();
    const dt = parseDate(row['Data']);

    // Determine entry.tipo based on sign and classification rules
    let tipo = val >= 0 ? 'entrada' : 'saida';
    
    // Create the DB entry payload
    entries.push({
      school_id: schoolId,
      data: dt,
      descricao: desc,
      valor: Math.abs(val),
      tipo: tipo,
      categoria: 'fluxo_realizado',
      origem: 'fluxo',
      tipo_original: cat,
      tipo_registro: 'realizado',
      editado_manualmente: false
    });
  });

  for (let i = 0; i < entries.length; i += 500) {
    const batch = entries.slice(i, i + 500);
    const { error: insErr } = await supabase.from('financial_entries').insert(batch);
    if (insErr) {
      console.error('Error inserting batch:', insErr);
      return;
    }
  }

  console.log(`Import complete! Inserted ${entries.length} entries into financial_entries.`);
}

main();
