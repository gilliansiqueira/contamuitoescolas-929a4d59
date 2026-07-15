// Lovable AI — verifica se a leitura/classificação dos métodos de pagamento
// está coerente e sugere correções (ex.: "Dinheiro lido como Boleto",
// "Débito lido como Crédito", "PIX lido como Sponte Pay").

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface RowIn {
  lineNumber: number;
  metodoRaw: string;
  metodoKey: string | null;
  valor: number;
  descricao?: string;
  qtd?: number;
}

interface ReqBody {
  rows: RowIn[];
  /** Métodos canônicos válidos (chaves). */
  allowedKeys: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: ReqBody;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Amostra para o modelo — agrupada por (raw → key) para reduzir tokens.
  const groups = new Map<string, { metodoRaw: string; metodoKey: string | null; qtd: number; exemplos: number[] }>();
  for (const r of body.rows) {
    const k = `${r.metodoRaw}||${r.metodoKey ?? '∅'}`;
    const qtd = Number.isFinite(r.qtd) && Number(r.qtd) > 0 ? Number(r.qtd) : 1;
    const g = groups.get(k);
    if (g) { g.qtd += qtd; if (g.exemplos.length < 3) g.exemplos.push(r.lineNumber); }
    else groups.set(k, { metodoRaw: r.metodoRaw, metodoKey: r.metodoKey, qtd, exemplos: [r.lineNumber] });
  }
  const distinct = [...groups.values()];

  const prompt = `Você é auditor de importação financeira. Cada linha do arquivo Sponte tem um texto bruto de "forma de cobrança" (metodoRaw) e foi classificada para uma chave canônica (metodoKey).

Chaves canônicas válidas: ${body.allowedKeys.join(', ')}.

Identifique APENAS classificações suspeitas ou incorretas. Exemplos de erros típicos:
- "Dinheiro" classificado como "boleto"
- "Cartão de Débito" classificado como "credito"
- "PIX" classificado como "sponte_pay"
- "Boleto Sponte Pay" classificado como "boleto" (deveria ser "boleto_sponte_pay")

Para cada grupo suspeito, retorne sugestão de correção. Não invente classes fora das chaves canônicas. Se TUDO está coerente, retorne lista vazia.

Retorne JSON exato:
{
  "sugestoes": [
    { "metodoRaw": "<texto bruto>", "atual": "<chave atual ou null>", "sugerida": "<chave válida>", "qtd": <number>, "motivo": "<string curta>" }
  ],
  "resumo": "<1-2 frases>"
}

Grupos a analisar:
${JSON.stringify(distinct)}`;

  try {
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: 'credits_exhausted' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: 'ai_error', detail: txt }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    let parsed: unknown = {};
    try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
