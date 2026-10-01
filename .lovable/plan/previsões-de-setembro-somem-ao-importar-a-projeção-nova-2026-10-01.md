# Previsões de setembro somem ao importar a projeção nova

## Causa confirmada
Quando um arquivo é enviado com **o mesmo nome e o mesmo tipo** de um envio anterior (por exemplo, "Contas a Pagar - Projeção.xls" todo mês), o sistema apaga **o envio anterior inteiro**, inclusive os lançamentos de setembro. Era uma proteção contra subir o mesmo arquivo duas vezes, mas ela ignora a data de corte.
- **Indaiatuba:** os envios antigos de Contas a Pagar com esse nome não existem mais, e hoje não há nenhuma conta a pagar prevista em setembro.
- **São Mateus, BH, Brasília e Farmácia Magistral** usam os mesmos nomes de arquivo todo mês ("Sponte - Projeção", "Cheque - Projeção" etc.).
- Isso quebra a regra "nunca perder histórico; substituir só a partir da data escolhida".

Ponto secundário: a importação auditada do Sponte substitui a partir da data mais antiga do arquivo, sem o limite de "hoje" que as outras importações já têm.

## O que vou fazer
1. **Reenvio com o mesmo nome:** não apagar mais o envio anterior inteiro. O envio antigo continua guardado, e só são substituídas as previsões a partir da data de corte escolhida (nunca antes de hoje), como já funciona na substituição normal. Lançamentos editados à mão e realizados ficam intactos.
2. **Sponte auditado:** aplicar o mesmo limite. Nada antes de hoje é removido. A tela de simulação mostra a data efetiva.
3. **Recuperar setembro:** os lançamentos apagados não têm cópia automática. Vou procurar cópias nas fotografias de fechamento de período. Onde não houver, a equipe reenvia os arquivos de setembro e, com a correção, eles não apagam o que vier depois. Antes, mostro por empresa quantos lançamentos e qual valor de setembro estão faltando.
4. Testes automáticos: reenviar um arquivo com o mesmo nome mantém os meses anteriores ao corte.
5. Publicar.

## Detalhes técnicos
- `useAddUpload` (`useFinancialData.ts`): remover o `delete` por `(school_id, file_name, tipo)`. A proteção contra duplicar passa a ser a substituição por corte em `FileUpload.performImport`.
- `ImportacaoSponteAuditada.goToReplace`: `desde = max(minDate, hoje)`.
- Para recuperar: consultar `period_closure_snapshots` de setembro, se houver, antes de pedir reenvio.
