# Completar impostos e pró-labore na planilha da Champagnat

## O que encontrei na plataforma
- **Impostos:** setembro não tem Simples Nacional lançado. Por isso a planilha ficou com 0%. Mas os outros meses têm: fev R$ 9.421,64, mar R$ 4.592,00, abr R$ 2.693,24, mai R$ 926,16, jun R$ 253,73, jul R$ 4.000,00 e ago R$ 3.003,43. Os valores variam muito de um mês para outro (parcelamentos e acertos).
- **Pró-labore:** a Champagnat não tem nenhum lançamento de pró-labore ou retirada dos sócios em 2026. Ou seja, os donos não retiram pela empresa, ou essa saída não é lançada.

## O que vou fazer
1. **Impostos (%):** somo o Simples e o ISS de jan a set/2026 e divido pela receita do mesmo período. Esse percentual entra na linha "Impostos", porque é mais justo que usar só um mês.
2. **Pró-labore:** fica R$ 0, igual à plataforma, com um comentário explicando que não há lançamento. Se os sócios retiram algum valor fora da empresa, é só me passar.
3. **Metas:** continuam em branco, esperando o cliente.
4. Recalculo a planilha e salvo uma nova versão (`DRE_Champagnat_v2.xlsx`), com o resultado e o ponto de equilíbrio atualizados.

## Detalhes técnicos
- Impostos de `realized_entries` (contas "Simples Nacional" e "Iss"); receita de `historical_monthly` (tipo receita), jan–set/2026. O percentual vai fixo em C18, com a fonte num comentário.
- Edição com openpyxl em cima da v1 e conferência dos valores calculados no LibreOffice. Nenhuma mudança no sistema.
