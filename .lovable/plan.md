# BH Cidade Jardim: voltar a Conferência para 46 avisos

## O que aconteceu
Não é falta de atualizar. A planilha da BH Cidade Jardim foi recalculada de novo hoje às 13:41 com a data de corte **01/10/2026**, e não com 01/05/2026. Com o corte em outubro, voltaram os 60 avisos (37 "sem parcela", 21 "sem turma", 1 com vários contratos, 1 em duas turmas). As mensagens salvas agora dizem "a partir de 01/10/2026", o que confirma isso. São Carlos não foi afetada e continua com 01/05.

## O que vou fazer
1. Voltar a data de corte da BH Cidade Jardim para **01/05/2026** e recalcular a planilha pela tela, como a equipe faz.
2. Conferir que a Conferência volta para cerca de 46 avisos e que a forma de pagamento continua em 223 dos 225 alunos, sem mudar o que a equipe preencheu.
3. Evitar que aconteça de novo: quando a data de corte da tela estiver diferente da que está salva, ou quando alguém recalcular com uma data mais tarde que a anterior, mostrar um aviso pedindo confirmação ("Isso vai trazer de volta alunos que já tinham saído da Conferência").

## Detalhes técnicos
- `renewal_sheets.params.minDue` da sheet `4dc7e15c…` está `2026-10-01` (atualizado 16:41 UTC); repor `2026-05-01` e rodar `rebuildSheet`.
- Em `RenovacaoModule.tsx` (`recalc`), pedir confirmação quando o novo `minDue` for posterior ao salvo.
