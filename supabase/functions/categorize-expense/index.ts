// Fallback opcional de categorização por IA.
// É chamado APENAS quando todas as camadas determinísticas falham.
// Nunca sobrescreve regras existentes — apenas sugere.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
  raw: string;
  descricao?: string;
  candidates: string[]; // categorias conhecidas
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { raw, descricao, candidates } = (await req.json()) as Body;
    if (!raw || !Array.isArray(candidates) || candidates.length === 0) {
      return new Response(JSON.stringify({ target: null, score: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) {
      return new Response(JSON.stringify({ target: null, score: 0, error: 'no_key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system =
      'Você categoriza despesas contábeis em português. Receba o nome bruto e a lista de categorias válidas. Retorne EXATAMENTE o nome de uma categoria da lista, ou a string vazia se nenhuma fizer sentido. Não invente categorias.';
    const user = `Texto: "${raw}"${descricao ? `\nDescrição: "${descricao}"` : ''}\n\nCategorias válidas (escolha uma):\n${candidates.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nResponda apenas com o nome exato da categoria escolhida (ou vazio).`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0,
      }),
    });

    if (resp.status === 402) {
      return new Response(JSON.stringify({ target: null, score: 0, error: 'credits' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resp.status === 429) {
      return new Response(JSON.stringify({ target: null, score: 0, error: 'rate_limit' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!resp.ok) {
      return new Response(JSON.stringify({ target: null, score: 0, error: 'upstream' }), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const text = String(data?.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');

    // Valida que a resposta é uma das categorias permitidas
    const match = candidates.find((c) => c.toLowerCase() === text.toLowerCase());
    if (!match) {
      return new Response(JSON.stringify({ target: null, score: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ target: match, score: 0.78, method: 'ai' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ target: null, score: 0, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
