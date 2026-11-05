# Textos de análise com cara de equipe (Relatório e Projeção)

## O que muda para você
Na Central, no "Texto da análise para o cliente", vai ter dois botões:

1. **Gerar texto do Relatório** (fechamento do mês, igual ao exemplo de Sinop)
   - Abre com o título "Relatório <Escola> - <Mês Ano>" e Receitas, Despesas e Resultado.
   - Evolução das receitas e despesas: comparação com o mesmo mês e com a média do ano anterior, e tendência dos últimos 3 meses (ex.: "queda de 11%, aproximadamente 20 mil a menos por mês").
   - Categorias de despesa que mais pesaram no ano e no mês (ex.: rescisões, franqueadora), dizendo se subiram ou reduziram.
   - KPIs do mês preenchidos nos Indicadores (lucratividade, inadimplência, alunos por turma, evasão, desconto, contatos do comercial), comparando com a média do ano e com 2025, em frases curtas.
2. **Gerar texto da Projeção**
   - Como fechou o mês: recebeu/pagou mais ou menos que o previsto e quanto.
   - Como fica o mês atual: menor saldo previsto, em que dia, e se pode faltar dinheiro.
   - Cenário futuro de matrículas/renovações, quando houver esse número na plataforma (senão o texto deixa um lembrete para a equipe completar).

## Tom
- Escrito como a equipe escreve: próximo, leve, com 1 ou 2 emojis quando a notícia é boa ou de esperança (🎉 🙏🏼), sem títulos numerados nem cara de robô.
- Seu exemplo vira o modelo de estilo da IA.
- Tamanho parecido com o exemplo (cerca de 1.200 caracteres); um contador mostra o tamanho do texto.
- Continua sendo rascunho: a equipe revisa, edita e salva antes de enviar.

## Segurança dos números
- Todos os valores e percentuais são calculados pela plataforma (mesmos números do Dashboard, Indicadores e Fluxo Diário) e enviados prontos; a IA só escreve.
- Se o texto da IA trouxer um valor que não está na lista enviada, a plataforma avisa antes de salvar.
- Quando falta um dado (ex.: KPI do mês não preenchido), a frase é omitida em vez de inventada.

## Detalhes técnicos
- Nova regra pura `src/lib/reportNarrativeFacts.ts` (testada) que monta os "fatos" a partir de `calculateTotals`/`buildMonthMovement` (SSOT): totais do mês, mesmo mês do ano anterior, média 12m, tendência 3m, variações por categoria (top 3), KPIs de `kpi_values` com média anual e ano anterior, previsto x realizado do mês fechado, menor saldo do Fluxo Diário do mês atual (`dailyFlow`), matrículas/renovações quando existirem.
- Edge Function `draft-monthly-analysis` ganha `kind: 'relatorio' | 'projecao'`, prompt com o exemplo de Sinop como referência de estilo, limite de caracteres e temperatura um pouco maior; modelo continua no gateway de IA.
- Verificação pós-geração: extrai números do texto e compara com os fatos enviados; diferenças viram aviso na tela.
- Textos salvos separados em `monthly_report_analyses` (coluna `kind`, migração com padrão `relatorio`, mantendo os textos já salvos).
- Teste em `src/test/reportNarrativeFacts.test.ts` com valores do exemplo (variação de 11%, comparação com média).
