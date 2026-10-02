# Portão: cheques depositados pelos sócios (receita + pró-labore)

## Ideia
Criar o botão **"Cheques depositados pelos sócios"** no Fluxo Bancário (Movimentações). Ele grava **dois lançamentos do mesmo valor, na mesma data**:
- **Entrada:** Receita (ex.: "Cheques depositados por Marta/Ariel")
- **Saída:** Pró-Labore (mesmo valor)

Resultado:
- A Receita e a Despesa (Pró-Labore) aparecem no Dashboard e no Resultado, como você fazia na planilha.
- **O saldo de cada banco não muda**: os dois lançamentos ficam numa conta separada, "Fora do banco (sócios)", que sempre fecha em zero. Ela não entra na conferência com o extrato e não trava o botão de ativação.

## Como a equipe usa
1. Clica em "Cheques depositados pelos sócios".
2. Informa data, valor (ex.: R$ 20.535,76), sócio (Marta, Ariel ou ambos) e uma observação.
3. Confere a prévia (entrada R$ X / saída R$ X / efeito no caixa R$ 0,00) e confirma.
4. Pode excluir o par depois; a exclusão apaga os dois juntos e fica no histórico.

## Regras
- Só admins veem o botão.
- O botão aparece em qualquer mês. Ele só **bloqueia** a gravação em mês que você fechou oficialmente em "Fechamento de meses". Portão não tem nenhum mês fechado hoje, então dá para lançar os R$ 20.535,76 em setembro normalmente.
- Entrada e saída são sempre criadas e apagadas juntas, nunca sozinhas.
- Quem criou, quando e o valor ficam no Histórico de Alterações.
- Vale para qualquer empresa. Por enquanto só aparece se você ligar para a empresa (começando por Portão).

## Detalhes técnicos
- Conta virtual por empresa em `bank_accounts` (flag nova `is_virtual`, saldo inicial 0), sem extrato. A prévia de ativação e a conferência de saldo ignoram contas virtuais.
- RPC security definer `create_partner_cheque_pair(_school_id, _data, _valor, _socio, _nota)`: valida admin e mês aberto, insere 2 `bank_transactions` (entrada com o item de Receita do modelo; saída com o item Pró-Labore), marca como conciliadas, liga as duas por `transfer_pair_id`, grava `audit_log` e roda `sync_bank_cashflow_tx`. Uma RPC `delete_partner_cheque_pair` remove as duas.
- Classificação continua pela SSOT (`model_item_id` → tipoMeta/ledgerEngine). Nada de heurística pelo sinal.
- Migration com GRANT/RLS conforme o padrão; teste automático: efeito no caixa = 0, Receita +X, Despesa +X.

## Uma pergunta
Na planilha, a entrada era um item de receita específico (ex.: "Mensalidades" ou "Cheques")? Se não disser, uso o item de receita de mensalidades do modelo de Portão e deixo a equipe trocar na hora de lançar.
