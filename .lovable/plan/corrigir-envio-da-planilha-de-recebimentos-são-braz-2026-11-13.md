# Corrigir envio da planilha de recebimentos (São Braz)

## O que aconteceu
A gravação foi recusada pela regra de acesso da aba Cartões: ela exige que a pessoa esteja vinculada à empresa, e quem é super admin sem vínculo direto com São Braz ficou de fora. A planilha da Stone em si está boa (144 recebimentos de novembro).

## O que vou fazer
1. Liberar a aba Cartões para qualquer pessoa da equipe, em qualquer empresa, mesmo que não seja da carteira dela, para uma poder ajudar a outra. Clientes continuam sem acesso, e as empresas restritas seguem só para super admin.
2. Ajustar a leitura da planilha da Stone:
   - "Nº DA PARCELA" vira a parcela (hoje pegaria "QTD DE PARCELAS");
   - "STONE ID" vira o identificador da venda;
   - "DATA DE VENCIMENTO" vira a data de pagamento.
3. Testar com esta planilha: 144 linhas, total bruto e líquido conferidos, período de 03/11 a 13/11 (aprox.).

## Detalhes técnicos
- Nova migration recriando as políticas permissivas de `card_sheet_imports`/`card_sheet_rows` como `is_admin()` (equipe inteira, sem exigir vínculo com a empresa); RESTRICTIVE `can_see_school` permanece.
- `cardSheetParse.ts`: padrão de parcela prioriza "n(º|o) da parcela", ignora "qtd"; teste novo com o cabeçalho da Stone.
