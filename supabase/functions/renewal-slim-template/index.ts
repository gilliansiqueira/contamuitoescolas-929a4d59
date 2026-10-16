import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Unzip, UnzipInflate, zipSync, strToU8 } from 'npm:fflate@0.8.2';
import { SheetTrimmer, SLIM_MAX_ROW } from './slim.ts';

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: 'Faça login novamente.' }, 401);

    const body = await req.json().catch(() => ({}));
    const schoolId = String(body.school_id ?? ''); const path = String(body.path ?? '');
    if (!/^[0-9a-f-]{36}$/.test(schoolId) || !path.startsWith(`${schoolId}/`) || path.includes('..')) return json({ error: 'Pedido inválido.' }, 400);

    const [{ data: isAdm }, { data: canSee }] = await Promise.all([userClient.rpc('is_admin'), userClient.rpc('can_see_school', { _school_id: schoolId })]);
    if (!isAdm || !canSee) return json({ error: 'Sem permissão para esta empresa.' }, 403);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: signed, error: se } = await admin.storage.from('renewal-files').createSignedUrl(path, 300);
    if (se || !signed) return json({ error: 'Arquivo não encontrado.' }, 404);
    const resp = await fetch(signed.signedUrl);
    if (!resp.ok || !resp.body) return json({ error: 'Não consegui baixar o arquivo.' }, 502);

    const files: Record<string, Uint8Array> = {};
    const pending: Promise<void>[] = [];
    const uz = new Unzip(); uz.register(UnzipInflate);
    uz.onfile = f => {
      pending.push(new Promise((res, rej) => {
        const isSheet = /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name);
        const tr = new SheetTrimmer(SLIM_MAX_ROW); const parts: Uint8Array[] = [];
        f.ondata = (err, chunk, final) => {
          if (err) return rej(err);
          if (isSheet) tr.pushBytes(chunk, final); else parts.push(chunk);
          if (final) {
            if (isSheet) files[f.name] = strToU8(tr.done());
            else { const n = parts.reduce((a, p) => a + p.length, 0); const o8 = new Uint8Array(n); let o = 0; for (const p of parts) { o8.set(p, o); o += p.length; } files[f.name] = o8; }
            res();
          }
        };
        f.start();
      }));
    };
    const reader = resp.body.getReader();
    let prev: Uint8Array | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (prev) uz.push(prev, false);
      prev = value;
    }
    uz.push(prev ?? new Uint8Array(0), true);
    await Promise.all(pending);
    const z = zipSync(files);

    const slimPath = `${schoolId}/modelos/slim-${Date.now()}.xlsx`;
    const up = await admin.storage.from('renewal-files').upload(slimPath, z, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (up.error) return json({ error: `Não consegui salvar a versão enxuta: ${up.error.message}` }, 500);
    return json({ slim_path: slimPath, original_path: path, bytes: z.byteLength });
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Erro ao ler o modelo.' }, 500);
  }
});
