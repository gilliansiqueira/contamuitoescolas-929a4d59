// Lovable AI Gateway — reconciliation analysis of import differences.
// Receives a structured payload with diffs + sample rows and returns a list of
// possible causes (duplication, double delay, weekend shift, etc.).

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface ReqBody {
  schoolId: string;
  totalDiff: number;
  perMethod: Array<{
    method: string;
    label: string;
    arquivoValor: number;
    sistemaValor: number;
    diferencaValor: number;
    diferencaQtd: number;
  }>;
  sampleSistemaRows?: Array<{
    data: string; valor: number; categoria: string; descricao: string;
    data_original?: string | null; delay_rule_applied?: unknown;
  }>;
  context?: string;
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
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const prompt = `Você é um auditor financeiro. Analise as diferenças entre um arquivo Sponte importado e o que está atualmente no sistema. Classifique cada diferença em uma ou mais causas prováveis:

- duplicacao: lançamento já existia de upload anterior
- delay_duplicado: prazo aplicado duas vezes
- delay_nao_aplicado: prazo não aplicado quando deveria
- deslocado_fim_de_semana: data caiu em sábado/domingo e foi para segunda
- substituicao_parcial: upload anterior não foi totalmente substituído
- categoria_incorreta: método de pagamento mapeado errado
- metodo_incorreto: ex. Cartão de Débito tratado como Crédito

Retorne JSON com este formato exato:
{
  "causas": [
    { "tipo": "<um dos acima>", "valor_estimado": <number>, "explicacao": "<string curta>" }
  ],
  "resumo": "<1-2 frases>"
}

Diferença total: ${body.totalDiff.toFixed(2)}
Por método:
${body.perMethod.map(m => `- ${m.label}: arquivo=${m.arquivoValor.toFixed(2)} sistema=${m.sistemaValor.toFixed(2)} diff=${m.diferencaValor.toFixed(2)} (${m.diferencaQtd} registros)`).join('\n')}

${body.context ? `Contexto: ${body.context}\n` : ''}
${body.sampleSistemaRows?.length ? `Amostra do sistema:\n${JSON.stringify(body.sampleSistemaRows.slice(0, 20))}` : ''}`;

  try {
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
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
