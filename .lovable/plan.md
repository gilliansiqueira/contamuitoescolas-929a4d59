# Ler o extrato completo da Plataforma Hubla (Go Company)

## O que está acontecendo
O PDF é o "Contas & Extratos" exportado do Nibo. Nele, a data aparece só na primeira linha de cada dia; as demais linhas do mesmo dia vêm sem data. Além disso, as saídas aparecem entre parênteses, ex.: (365,13). O leitor atual só aproveita linhas com data, por isso pegou apenas 2 das 15.

Conteúdo real do arquivo (setembro/2026):
- 03/09: 13 lançamentos — 5 entradas (R$ 6.713,63) e 8 saídas (R$ 6.713,63), incluindo a transferência de R$ 4.843,53 para o Sicoob; saldo do dia fecha em R$ 0,00.
- 22/09: 1 entrada de R$ 204,17.
- Saldo anterior R$ 0,00 em 31/08.

## O que será feito
1. Novo leitor específico para o PDF "Contas & Extratos" do Nibo:
   - Linhas sem data herdam a data da última linha datada (inclusive na virada de página).
   - Valores entre parênteses viram saída; os demais, entrada.
   - Usa Nome + Descrição como descrição do lançamento.
   - Ignora cabeçalhos, rodapés (endereço do Nibo, "1/2") e o gráfico.
2. Conferência obrigatória: saldo anterior + lançamentos precisa bater com cada "Saldo" impresso (ex.: R$ 0,00 no fim de 03/09). Se não bater, a importação é bloqueada mostrando a diferença — como nos demais PDFs.
3. A linha "Transferência de 03 Plataforma Hubla para 01 Sicoob" continua sendo reconhecida como transferência entre contas pela regra que já existe.
4. Teste automático com este arquivo: 14 lançamentos, totais acima e saldo final R$ 204,17.

## Depois
Na Go Company, basta reenviar o mesmo PDF: a conferência mostrará todas as linhas. As 2 que já existirem não duplicam.

## Detalhes técnicos
- `src/lib/bankStatements/parsers.ts`: detectar "Contas & Extratos" + cabeçalho "Data Nome Descrição Ref. Identif. Entrada Saída Saldo"; carregar data corrente; parênteses = saída; valor na coluna Saldo usado só como âncora de conferência.
- Novo teste em `src/test/bankNiboPdf.test.ts` com fixture do texto extraído.
- Nenhuma alteração em cálculos financeiros ou no banco de dados.
