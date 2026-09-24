# Conferência: planilha "Fluxo BB" x extrato do Banco do Brasil (Dourados)

## O que a planilha mostra
- A planilha controla o **saldo em conta** e registra "Aplicação" e "Resgate" como linhas. A coluna à direita traz o **saldo com aplicação**, que em 31/08 era **R$ 122.677,73**.
- Agosto termina com R$ 599,00 em conta. Esse valor vem de duas linhas lançadas em 31/08: Cobrança R$ 484,00 e PIX Carlos Barb R$ 115,00.

## Onde ela difere do banco (setembro, linha a linha)
1. **R$ 484,00 e R$ 115,00**: estão em 31/08 na planilha, mas o banco só creditou em **01/09**. Por isso o banco começa setembro com **R$ 0,00 em conta**, e não R$ 599,00.
2. **R$ 599,00 (depósito de cheque)**: está em 02/09 na planilha e em 01/09 no banco.
3. **R$ 170,00 (Franciele)**: a data foi digitada errada na planilha ("99-01-01"). No banco é 01/09.
4. **R$ 1.550,77 (Cobrança)**: está em 17/09 na planilha e em 18/09 no banco.
5. **Ainda não lançados na planilha** (23 e 24/09): Rende Fácil −R$ 1.618,59, tarifa −R$ 7,41, dois PIX de R$ 85,00 e Cobrança R$ 1.200,80.

O restante de setembro (cerca de 105 linhas) bate exatamente com o banco, em data e valor.

## Saldos corretos para cadastrar a conta BB (pela data do banco)
```text
Em 31/08/2026
  Saldo em conta ............. R$       0,00
  Aplicado (Rende Fácil) ..... R$ 122.078,73   (122.677,73 - 599,00)
  Total ...................... R$ 122.078,73

Em 24/09/2026, depois do extrato importado
  Saldo em conta ............. R$   1.200,80   (igual ao saldo informado pelo banco)
  Aplicado ................... R$ 149.527,20   (+ 27.448,47 aplicados em setembro)
  Total ...................... R$ 150.728,00
```
Os R$ 599,00 não somem: entram em 01/09, junto com o extrato.

## O que muda na plataforma
Nenhuma mudança no sistema é necessária. A plataforma já calcula os dois saldos. Falta só:
1. Cadastrar a conta BB da Dourados com saldo em conta R$ 0,00 em 31/08/2026, marcar "aplicação automática" e informar R$ 122.078,73 aplicados em 31/08/2026.
2. Importar o OFX de setembro e digitar R$ 150.728,00 como "saldo com aplicação" na conferência. O resumo deve mostrar "confere" nos dois saldos.

Se você preferir, faço esse cadastro por você depois da aprovação. Senão, a equipe faz pela tela.

## Ponto para confirmar
- A planilha usa a data em que o lançamento foi recebido; o banco usa a data do crédito. A plataforma seguirá sempre a **data do banco**, porque é a única que bate com o saldo do extrato.
