const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function main() {
  const { data: entries, error } = await supabase.from('financial_entries').select('*');
  if (error) {
    console.error('Error fetching entries:', error);
    return;
  }
  
  console.log(`Total entries: ${entries.length}`);
  const origins = {};
  const categories = {};
  const types = {};
  const typeOriginals = {};
  const dates = new Set();
  
  entries.forEach(e => {
    origins[e.origem] = (origins[e.origem] || 0) + 1;
    categories[e.categoria] = (categories[e.categoria] || 0) + 1;
    types[e.tipo] = (types[e.tipo] || 0) + 1;
    typeOriginals[e.tipo_original] = (typeOriginals[e.tipo_original] || 0) + 1;
    dates.add(e.data);
  });
  
  console.log('Origins:', origins);
  console.log('Categories:', categories);
  console.log('Types:', types);
  console.log('Original Types:', typeOriginals);
  console.log(`Unique dates count: ${dates.size}. Min date: ${Array.from(dates).sort()[0]}, Max date: ${Array.from(dates).sort().reverse()[0]}`);
  
  if (entries.length > 0) {
    console.log('Sample entry:', entries[0]);
  }
}

main();
