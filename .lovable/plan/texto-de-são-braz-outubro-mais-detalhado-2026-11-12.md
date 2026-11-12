# Texto de São Braz (outubro) mais detalhado

## O que muda para você
1. **Texto de outubro de São Braz reescrito agora**, com os números da plataforma:
   - Despesas: quais categorias mais subiram (e quanto, em R$ e %) em relação a outubro/2025 e à média dos 3 meses anteriores, e quais caíram.
   - Receitas: de onde veio a queda de 3% no mês (ex.: mensalidades x material), quando a plataforma tiver esse detalhe.
   - Indicadores: cada um com mês anterior, média do ano e mesmo período do ano passado, explicando o que puxou (ex.: inadimplência subiu de X para 3,50%; turmas menores com 4,32 alunos).
   - Comercial: matrículas do mês e acumulado comparados com o ano anterior, com os números (hoje só diz "ficou abaixo").
   - Fechamento com 2–3 pontos de ação para a próxima reunião.
   Mantendo o tom de equipe, profundo mas curto. Te mando o texto aqui no chat para revisar antes de usar.
2. **Próximos relatórios de todas as empresas** passam a vir assim automaticamente: o gerador de texto recebe os maiores aumentos e reduções de despesas por categoria e os números do comercial do ano anterior.

## Detalhes técnicos
- `src/lib/reportNarrativeFacts.ts`: novo fato "Maiores aumentos/reduções de despesas" (top 3 cada) por categoria vs mesmo mês do ano anterior e vs média 3 meses, usando `expenseByCategory` (SSOT via `resolveEntryLedgerRule`, sem heurística de sinal); números absolutos de matrículas mês/acumulado vs ano anterior.
- Instrução na Edge Function `draft-monthly-analysis`: citar os aumentos de despesas com valores e fechar com pontos de ação.
- Teste novo em arquivo de teste existente cobrindo o ranking de aumentos (valores concretos).
- O texto de São Braz é gerado lendo os dados de outubro/2026 do banco com as mesmas regras; nada é gravado nos lançamentos.
