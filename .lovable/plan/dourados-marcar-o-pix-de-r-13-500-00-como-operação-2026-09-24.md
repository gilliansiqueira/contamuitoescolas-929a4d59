# Dourados: marcar o Pix de R$ 13.500,00 como Operação

## O que muda
- **O que muda:** o Pix enviado em 01/09/2026 para "Camila Kussakari Pegorer", de R$ 13.500,00, passa para a categoria **Operação** (distribuição de lucros). Uma observação é adicionada: "Distribuição de lucros".
- **O que não muda:** os Pix de R$ 7.000,00 (01/09) e R$ 900,00 (04/09) para a mesma pessoa continuam como **Saída**, porque são salário.
- **Efeito no mês:** Saídas realizadas de setembro diminuem R$ 13.500,00 e o cartão Operações passa a mostrar esse valor. O saldo não muda.
- **Histórico:** a alteração fica registrada no histórico da linha. O valor, a data e a descrição do banco continuam iguais.

## Detalhes técnicos
- Ajuste de dados, sem mudança na estrutura do banco. Em `bank_transactions`, a linha id `8f827f48-09a7-4963-b9c4-d1e4da6716f0` recebe `movement_kind = 'operacao'` e `recon_note = 'Distribuição de lucros'`.
- O trigger `guard_bank_tx_immutable` grava o histórico automaticamente.
- Depois do ajuste, confirmar pela leitura que só essa linha mudou.
