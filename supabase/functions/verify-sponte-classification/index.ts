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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeDetail(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 700);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) {
    return jsonResponse({ error: 'LOVABLE_API_KEY missing' }, 500);
  }

  let body: ReqBody;
  try { body = await req.json(); }
  catch {
    return jsonResponse({ error: 'invalid json' }, 400);
  }

  if (!Array.isArray(body.rows) || !Array.isArray(body.allowedKeys) || body.allowedKeys.length === 0) {
    return jsonResponse({ error: 'invalid payload' }, 400);
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
  const distinct = [...groups.values()]
    .sort((a, b) => b.qtd - a.qtd || a.metodoRaw.localeCompare(b.metodoRaw))
    .slice(0, 120)
    .map((g) => ({
      metodoRaw: g.metodoRaw.slice(0, 120),
      metodoKey: g.metodoKey,
      qtd: g.qtd,
      exemplos: g.exemplos,
    }));

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
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
        'X-Lovable-AIG-SDK': 'manual-edge-function',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Responda APENAS com JSON válido.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1200,
      }),
    });

    if (aiRes.status === 429) {
      return jsonResponse({ sugestoes: [], resumo: 'A análise por IA foi pulada por limite temporário. A conferência do arquivo continua válida.', warning: 'rate_limited' });
    }
    if (aiRes.status === 402) {
      return jsonResponse({ sugestoes: [], resumo: 'A análise por IA foi pulada por falta de créditos. A conferência do arquivo continua válida.', warning: 'credits_exhausted' });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error('verify-sponte-classification ai_error', aiRes.status, safeDetail(txt));
      return jsonResponse({
        sugestoes: [],
        resumo: `A IA recusou a análise (${aiRes.status}). Isso não significa erro na leitura do arquivo; a importação pode seguir pela conferência manual.`,
        warning: 'ai_error',
        status: aiRes.status,
        detail: safeDetail(txt),
      });
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    let parsed: unknown = {};
    try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }

    return jsonResponse(parsed);
  } catch (err) {
    console.error('verify-sponte-classification exception', String(err));
    return jsonResponse({
      sugestoes: [],
      resumo: 'A análise por IA falhou antes de concluir. A conferência do arquivo continua válida e pode ser aprovada manualmente.',
      warning: 'exception',
      detail: String(err).slice(0, 700),
    });
  }
});
