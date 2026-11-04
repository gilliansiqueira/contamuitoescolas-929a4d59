// Tira-dúvidas da equipe: responde SOMENTE com base nos guias cadastrados (help_articles).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const Body = z.object({ pergunta: z.string().trim().min(3).max(1000) });

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sabe: { type: 'boolean' },
    resposta: { type: 'string' },
    fontes: { type: 'array', items: { type: 'string' } },
  },
  required: ['sabe', 'resposta', 'fontes'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('authorization');
    if (!auth) return json({ error: 'unauthorized' }, 401);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: 'unauthorized' }, 401);
    const { data: isAdmin } = await sb.rpc('is_admin');
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Escreva a pergunta (3 a 1000 caracteres).' }, 400);
    const { pergunta } = parsed.data;

    const { data: arts } = await sb.from('help_articles').select('slug,titulo,conteudo').order('ordem');
    const guias = (arts ?? []).map(a => `### [${a.slug}] ${a.titulo}\n${a.conteudo}`).join('\n\n').slice(0, 60000);

    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'no_key' }, 500);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra',
        stream: true,
        store: false,
        reasoning: { effort: 'low' },
        instructions: 'Você é o tira-dúvidas interno de uma equipe de BPO financeiro. Responda em português do Brasil, em passos curtos e numerados, usando APENAS o conteúdo dos guias fornecidos. Se os guias não cobrirem a pergunta, responda sabe=false e diga que a pergunta foi enviada para a gestora. Em fontes, liste os slugs (entre colchetes) dos guias usados.',
        input: [{ role: 'user', content: `GUIAS:\n${guias}\n\nPERGUNTA: ${pergunta}` }],
        text: { format: { type: 'json_schema', name: 'resposta', strict: true, schema } },
      }),
    });
    if (resp.status === 402) return json({ error: 'Sem créditos de IA no momento.' }, 402);
    if (resp.status === 429) return json({ error: 'Muitas perguntas seguidas, tente em instantes.' }, 429);
    if (resp.status === 403) return json({ error: 'IA indisponível para este espaço.' }, 403);
    if (!resp.ok || !resp.body) return json({ error: 'Não foi possível responder agora.' }, 502);

    // Consome o stream SSE e junta o texto final.
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const d = line.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === 'response.output_text.delta') text += ev.delta ?? '';
        } catch { /* ignora linha parcial */ }
      }
    }
    let out = { sabe: false, resposta: 'Não consegui responder agora.', fontes: [] as string[] };
    try { out = JSON.parse(text); } catch { /* mantém padrão */ }
    const valid = new Set((arts ?? []).map(a => a.slug));
    out.fontes = (out.fontes ?? []).map(f => f.replace(/[[\]]/g, '')).filter(f => valid.has(f));

    await sb.from('help_questions').insert({ user_id: u.user.id, pergunta, resposta: out.resposta, respondida: !!out.sabe, fontes: out.fontes });
    return json(out);
  } catch (_e) {
    return json({ error: 'internal' }, 500);
  }
});
