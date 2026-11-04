# Contas a pagar "vencidas sem saída": deixar o acompanhamento confiável

## Por que hoje aparecem contas demais (pelo que o código faz)
O aviso considera uma conta paga só se encontrar no extrato **uma saída de valor quase igual (até R$ 20 de diferença) entre o vencimento e alguns dias depois**. Isso falha em casos comuns:
1. **Pagamento antecipado**: conta paga antes do vencimento (ex.: vencimento no fim de semana, pago na sexta) não é reconhecida.
2. **Vários boletos pagos numa saída só** (pagamento em lote) ou uma conta paga em partes: nenhum valor isolado bate.
3. **Juros/multa/desconto acima de R$ 20**: o valor pago diferente não bate.
4. A plataforma não usa a **conciliação já feita pela equipe** (a saída conciliada com aquele item do modelo) — só compara valores.
5. Não há como a equipe dizer "esta saída é esta conta" direto no aviso; só "marcar visto".

## O que vamos fazer
1. **Primeiro, medir**: para 3–4 empresas com muitos avisos, listar cada conta "vencida sem saída" e qual saída do extrato provavelmente a pagou, classificando o motivo (antecipado, lote, juros, sem extrato, realmente em aberto). Assim confirmamos a causa antes de mudar a regra.
2. **Regra de reconhecimento mais esperta** (em ordem):
   - saída conciliada com o mesmo item do modelo (categoria) e valor próximo;
   - aceitar pagamento de até 5 dias úteis **antes** do vencimento;
   - tolerância proporcional (ex.: R$ 20 ou 3% do valor, o maior) para juros/desconto;
   - lote: soma de contas do mesmo dia batendo com uma saída;
   - cada saída só quita uma conta (sem usar a mesma saída duas vezes).
3. **Vincular na hora**: no aviso, botão "Já foi paga" abre as saídas do extrato próximas (data/valor) para escolher qual pagou; fica gravado e some do aviso. Mantém "Não foi paga / agendar" como alternativa.
4. **Mostrar o porquê**: cada aviso exibe "nenhuma saída de R$ X entre DD/MM e DD/MM" e a saída mais parecida encontrada, para a equipe entender a ligação conta ↔ lançamento.

## Detalhes técnicos
- Lógica de casamento extraída para `src/lib/payableMatching.ts` (pura, com testes de antecipado, lote, juros e não reutilização da saída); `useMyDay.ts` passa a buscar saídas desde vencimento −7 dias e com item conciliado.
- Vínculo manual: nova coluna opcional `bank_transaction_id` em `payable_acknowledgements` (migração aditiva), reaproveitando a tabela existente.
- Nada entra em cálculos financeiros; é só acompanhamento.
