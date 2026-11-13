# Corrigir envio da planilha de recebimentos (São Braz)

## O que aconteceu
A gravação foi recusada pela regra de acesso da aba Cartões: ela exige que a pessoa esteja vinculada à empresa, e quem é super admin sem vínculo direto com São Braz ficou de fora. A planilha da Stone em si está boa (144 recebimentos de novembro).

## O que vou fazer
1. Liberar super admin em todas as empresas na aba Cartões (como nas outras telas da equipe), mantendo a proteção das empresas restritas.
2. Ajustar a leitura da planilha da Stone:
   - "Nº DA PARCELA" vira a parcela (hoje pegaria "QTD DE PARCELAS");
   - "STONE ID" vira o identificador da venda;
   - "DATA DE VENCIMENTO" vira a data de pagamento.
3. Testar com esta planilha: 144 linhas, total bruto e líquido conferidos, período de 03/11 a 13/11 (aprox.).

## Detalhes técnicos
- Nova migration recriando as políticas permissivas de `card_sheet_imports`/`card_sheet_rows` como `is_super_admin() OR (is_admin() AND user_has_school_access(...))`; RESTRICTIVE `can_see_school` permanece.
- `cardSheetParse.ts`: padrão de parcela prioriza "n(º|o) da parcela", ignora "qtd"; teste novo com o cabeçalho da Stone.
