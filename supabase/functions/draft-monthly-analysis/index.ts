// Redige os textos de análise (relatório mensal ou projeção). Recebe apenas números já
// calculados pela SSOT no frontend; a IA nunca recalcula valores, apenas escreve.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const EXEMPLO = `Relatório Sinop - Setembro 2026

Receitas: R$ 181.042,28

Despesas: R$ 118.475,31

Resultado: R$ 62.566,97

Se compararmos a evolução das receitas vemos que a escola teve uma queda de 11%, aproximadamente 20 mil a menos por mês. Já as despesas no primeiro semestre subiram, mas nos últimos 3 meses já reduziram e conseguimos melhorar o resultado da operação da escola 🎉

Nas despesas já vimos que esse ano o que mais tem prejudicado a escola são os valores de rescisão, infelizmente em setembro tivemos mais valores altos nessa categoria. Na franqueadora no primeiro semestre também foram compras altas, mas agora nos últimos meses isso também reduziu 🙏🏼

Sobre os KPIs:

Lucratividade continua muito boa apesar da queda esse mês pra 12,82%, a média está em 17%. Já melhoramos nos últimos 3 meses, mas na média anual estamos 10% abaixo de 2025

Inadimplência caiu pra 5,5%

Média de alunos por turma muito boa em 5,13

Evasão ótima em 2,1%

Média de desconto também ótima em 12,4%`;

const BASE = `Você faz parte da equipe de um BPO financeiro que acompanha escolas e empresas, e escreve para o dono. Português do Brasil, tom próximo, leve e humano, como se a analista tivesse olhado os números com carinho — nada de texto quadrado, títulos numerados, listas com marcadores ou markdown (sem ** nem #). Frases curtas, parágrafos curtos. Use 1 ou 2 emojis só quando a notícia for boa ou de esperança (ex.: 🎉 🙏🏼). Seja honesta com notícias ruins, sem alarmismo.
REGRA DE OURO: use SOMENTE os números fornecidos, exatamente como estão (formato brasileiro). Pode arredondar em palavras ("aproximadamente 20 mil"), mas nunca crie valores ou percentuais novos. Se um dado não foi fornecido, não fale dele.`;

const PROMPTS: Record<string, string> = {
  relatorio: `${BASE}
Escreva o resumo do relatório mensal. Comece com o título e as três linhas Receitas / Despesas / Resultado. Depois: evolução de receitas e despesas (tendência e comparação com o ano anterior), quais categorias de despesa mais pesaram e, usando os fatos de "Despesas que mais aumentaram/reduziram", cite pelo nome e valor as 2 ou 3 categorias que explicam a variação das despesas, e "Sobre os KPIs:" com uma linha curta por indicador comentando (ótimo, bom, atenção) e comparando com média/ano anterior quando houver. Se houver fatos de "Forma de pagamento", inclua "Forma de pagamento:" com uma linha curta por forma e o percentual. Se houver fatos de "Comercial", SEMPRE feche com "Comercial:" — uma linha para Receptivo e outra para Ativo no formato "47 contatos → 10 matrículas (21,3% de conversão)" e, se houver comparação com o ano anterior, diga em uma frase se as matrículas estão acima ou abaixo (mês e acumulado). Se houver números de matrículas do ano anterior, cite-os. Feche com uma frase curta de próximos passos ligada aos pontos de atenção. Máximo de 2.000 caracteres.
Exemplo do estilo da equipe (siga o jeito, não copie os números):
${EXEMPLO}`,
  projecao: `${BASE}
Escreva o resumo da projeção olhando para o FUTURO (não reconte o mês passado; no máximo uma frase de contexto). Três parágrafos: 1) caixa do mês atual — menor saldo previsto, em que dia, como termina o mês e se há risco de faltar dinheiro, com a recomendação; 2) próximos meses — o que esperar de receitas, despesas e se algum mês aperta o caixa; 3) quantas matrículas e renovações precisam ser feitas por mês segundo a Simulação, com o total (se não houver, mantenha o lembrete entre colchetes). Máximo de 1.000 caracteres.
Exemplo do estilo da equipe:
${EXEMPLO}`,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    if (!req.headers.get('authorization')) return json({ error: 'unauthorized' }, 401);
    const { schoolName, monthLabel, facts, kind = 'relatorio', examples, guidelines } = await req.json();
    const ex = Array.isArray(examples) ? examples.filter((x: unknown) => typeof x === 'string').slice(0, 3).map((x: string) => x.slice(0, 2000)) : [];
    const guide = typeof guidelines === 'string' ? guidelines.slice(0, 1500).trim() : '';
    let extra = '';
    if (ex.length) extra += `\n\nTextos revisados e aprovados pela equipe (imite o estilo, a ordem e o tamanho; IGNORE todos os números deles):\n${ex.map((t: string, i: number) => `--- Exemplo ${i + 1} ---\n${t}`).join('\n')}`;
    if (guide) extra += `\n\nOrientações da equipe para esta empresa (siga sempre, sem inventar números):\n${guide}`;
    extra += `\n\nLucratividade: se os fatos trazem "Receitas (integral)", use esse valor e o resultado correspondente nas três linhas do topo e a lucratividade com receita integral como principal, mencionando a receita recebida só como observação; se trazem "Dois cenários", cite os dois explicando a diferença em uma frase.`;
    if (!schoolName || !monthLabel || typeof facts !== 'string' || !PROMPTS[kind]) return json({ error: 'invalid' }, 400);
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return json({ error: 'no_key' }, 500);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: PROMPTS[kind] + extra },
          { role: 'user', content: `Empresa: ${schoolName}\nMês: ${monthLabel}\n\nNúmeros oficiais do sistema:\n${facts.slice(0, 8000)}` },
        ],
        temperature: 0.6,
      }),
    });
    if (resp.status === 402) return json({ error: 'credits' }, 402);
    if (resp.status === 429) return json({ error: 'rate_limit' }, 429);
    if (!resp.ok) return json({ error: 'upstream' }, 502);
    const data = await resp.json();
    const text = String(data?.choices?.[0]?.message?.content ?? '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '');
    return json({ text });
  } catch (_e) {
    return json({ error: 'internal' }, 500);
  }
});
