// Redige os textos de análise (relatório mensal ou projeção). Recebe apenas números já
// calculados pela SSOT no frontend; a IA nunca recalcula valores, apenas escreve.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const EXEMPLO = `Relatório São Braz - outubro 2026

Receitas: R$ 181.405,51

Despesas: R$ 186.466,32

Resultado: -R$ 5.060,81

Nas receitas, tivemos uma leve redução de 3% em relação a outubro do ano anterior (R$ 187.772,06) e ficamos abaixo da média dos últimos 3 meses (R$ 228.972,90). No acumulado do ano o faturamento segue forte, com alta de 12%, somando R$ 2.087.253,31.

Nas despesas, o mês fechou 14% acima de outubro de 2025 (R$ 164.027,00). O que mais aumentou foi:
- Impostos: o Simples Nacional passou de R$ 5,4 mil para R$ 15,3 mil.
- Marketing: Propaganda (R$ 7,4 mil), Presentes/Mimos (R$ 3,9 mil) e Panfletagem (R$ 700), gastos que não tivemos em outubro do ano passado.
- Pessoal: subiram Salário dos Professores (R$ 26,4 mil, R$ 1,3 mil a mais), Vale-refeição (R$ 5,3 mil, R$ 2,1 mil a mais) e Rescisões (R$ 2,5 mil).

Em compensação, Materiais Didáticos caíram R$ 6,4 mil.

Sobre os KPIs:

Lucratividade fechou em -2,79% no mês, mas o ano segue saudável: no acumulado temos resultado de R$ 435.383,95 e lucratividade de 20,86% 🎉

Inadimplência subiu para 3,50%, acima do mês anterior (1,10%) e da média do ano (2,71%)

Média de alunos por turma ficou em 4,32, abaixo dos 6,34 do mês anterior e da média do ano de 5,67

Evasão foi ótima em 0,60%, bem abaixo da média do ano de 2,07% 🙏🏼

Média de desconto muito boa em 16,10%, menor que os 17,90% do mês anterior e abaixo da média anual de 18,48%

Comercial:

Receptivo: 46 contatos → 15 matrículas (32,6% de conversão)

Ficamos abaixo do mesmo mês do ano anterior, que teve 22 matrículas com 37 contatos. No acumulado também estamos abaixo, com 239 matrículas contra 259 em 2025.

Para os próximos passos, vamos acompanhar de perto o imposto e os gastos com marketing, e reforçar as ações comerciais para voltarmos ao resultado positivo.`;

const BASE = `Você faz parte da equipe de um BPO financeiro que acompanha escolas e empresas, e escreve para o dono. Português do Brasil, tom próximo, leve e humano, como se a analista tivesse olhado os números com carinho — nada de texto quadrado, títulos numerados, listas com marcadores ou markdown (sem ** nem #). Frases curtas, parágrafos curtos. Use 1 ou 2 emojis só quando a notícia for boa ou de esperança (ex.: 🎉 🙏🏼). Seja honesta com notícias ruins, sem alarmismo.
REGRA DE OURO: use SOMENTE os números fornecidos, exatamente como estão (formato brasileiro). Pode arredondar em palavras ("aproximadamente 20 mil"), mas nunca crie valores ou percentuais novos. Se um dado não foi fornecido, não fale dele.`;

const PROMPTS: Record<string, string> = {
  relatorio: `${BASE}
Escreva o resumo do relatório mensal. Comece com o título e as três linhas Receitas / Despesas / Resultado. Depois: receitas e despesas comparadas com o mesmo mês do ano anterior e o acumulado (pouco texto sobre tendência), nas despesas liste em tópicos curtos agrupados por tema (Pessoal, Impostos, Marketing etc.) o que aumentou, com valores, quais categorias de despesa mais pesaram e, usando os fatos de "Despesas que mais aumentaram/reduziram", cite pelo nome e valor as 2 ou 3 categorias que explicam a variação das despesas, e "Sobre os KPIs:" com uma linha curta por indicador comentando (ótimo, bom, atenção) e comparando com média/ano anterior quando houver. Se houver fatos de "Forma de pagamento", inclua "Forma de pagamento:" com uma linha curta por forma e o percentual. Se houver fatos de "Comercial", SEMPRE feche com "Comercial:" — uma linha para Receptivo e outra para Ativo no formato "47 contatos → 10 matrículas (21,3% de conversão)" e, se houver comparação com o ano anterior, diga em uma frase se as matrículas estão acima ou abaixo (mês e acumulado). Se houver números de matrículas do ano anterior, cite-os. Feche com uma frase curta de próximos passos ligada aos pontos de atenção. Se a lucratividade do mês for negativa mas houver resultado/lucratividade acumulados positivos, diga isso. Máximo de 2.200 caracteres.
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
