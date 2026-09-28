// Redige o rascunho da análise mensal. Recebe apenas números já calculados pela SSOT
// no frontend; a IA nunca recalcula valores, apenas escreve o texto.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    if (!req.headers.get('authorization')) return json({ error: 'unauthorized' }, 401);
    const { schoolName, monthLabel, facts } = await req.json();
    if (!schoolName || !monthLabel || typeof facts !== 'string') return json({ error: 'invalid' }, 400);
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'no_key' }, 500);

    const system = 'Você é analista financeira de um BPO que atende escolas e empresas. Escreva em português do Brasil, tom próximo e profissional, para o dono da empresa. Use SOMENTE os números fornecidos, exatamente como estão (formato brasileiro). Não invente valores nem percentuais novos. Estrutura: 1) Resumo do mês; 2) Projetado x realizado; 3) Pontos de atenção; 4) Próximos passos (vendas necessárias e caixa do próximo mês). Máximo de 250 palavras, sem markdown pesado.';
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Empresa: ${schoolName}\nMês: ${monthLabel}\n\nNúmeros oficiais do sistema:\n${facts.slice(0, 6000)}` },
        ],
        temperature: 0.3,
      }),
    });
    if (resp.status === 402) return json({ error: 'credits' }, 402);
    if (resp.status === 429) return json({ error: 'rate_limit' }, 429);
    if (!resp.ok) return json({ error: 'upstream' }, 502);
    const data = await resp.json();
    return json({ text: data?.choices?.[0]?.message?.content ?? '' });
  } catch (_e) {
    return json({ error: 'internal' }, 500);
  }
});
