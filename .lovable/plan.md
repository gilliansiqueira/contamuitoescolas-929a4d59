# Fazenda Rio Grande: corrigir o saldo do Bradesco

## O que encontrei
- Os 95 lançamentos do extrato do Bradesco (01/09 a 25/09) estão todos no sistema, sem nenhum faltando ou repetido. Somados, dão **-R$ 3.927,80** no mês.
- **Saldo inicial errado:** o saldo inicial da conta em 31/08 está como **R$ 1,00**, um valor provisório. Por isso o sistema calcula -R$ 3.926,80 e mostra a diferença de R$ 37.629,78.
- **Saldo do arquivo do banco:** o arquivo do Bradesco informa saldo de **R$ 33.702,98**. Esse número não é só a conta corrente. A diferença para os seus R$ 2.170,77 é de **R$ 31.532,21**, que deve ser o saldo aplicado (CDB / Invest Fácil). No extrato aparecem resgates de CDB (R$ 42.100,66 no mês) e rendimento do Invest Fácil.

## Conta que fecha
```text
Saldo em 31/08 (a corrigir)        R$ 6.098,57
Movimento de setembro             -R$ 3.927,80
Saldo em conta em 25/09            R$ 2.170,77
Aplicado (CDB/Invest Fácil)       R$ 31.532,21
Total informado pelo banco        R$ 33.702,98
```

## O que vou fazer
1. **Corrigir o saldo inicial** do Bradesco em 31/08 para **R$ 6.098,57**. Nenhum lançamento é alterado, e a correção fica registrada no histórico.
2. **Separar conta e aplicação nesta importação:** em conta R$ 2.170,77, aplicado R$ 31.532,21. Assim o "Saldo por conta" mostra as duas partes e a linha passa a "confere".
3. **Para as próximas importações:** quando o arquivo do Bradesco trouxer um saldo que não fecha com a conta corrente, a conferência antes de importar vai perguntar quanto está aplicado. O sistema não vai mais tratar o total como se fosse só a conta.

## Um ponto para você confirmar
Os R$ 6.098,57 de 31/08 saem de R$ 2.170,77 menos o movimento de setembro. Isso só é verdade se os R$ 2.170,77 forem o saldo **da conta corrente em 25/09, já com o débito "PROVISAO GASTO CART CRED" de R$ 4.012,26**. Se esse débito ainda não estiver no seu número, o saldo inicial muda. Se puder, confirme o saldo de 31/08 pelo extrato de agosto.

## O que não muda
Histórico antes de 01/09/2026, os lançamentos importados, Dashboard e cálculos oficiais. Só o saldo da conta passa a ser o certo.

## Detalhes técnicos
- Conta `5b844b55-942c-4d6a-92cf-bd9f0ddcef17`: `saldo_inicial` 1 para 6098,57 (data 2026-08-31), via run_sql, com registro em `audit_log`.
- Importação OFX: `saldo_final_informado` passa a 2170,77 e `saldo_aplicado_informado` a 33702,98 (total), seguindo o padrão usado no BB de Dourados.
- Na prévia do OFX em `BankAccountsImports.tsx`: se `saldo inicial + movimento` não bater com o LEDGERBAL, mostrar o campo de saldo aplicado já sugerindo a diferença, em vez de gravar o LEDGERBAL como saldo em conta.
