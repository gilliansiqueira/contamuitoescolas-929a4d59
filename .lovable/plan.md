# Fluxo Bancário: saldo em conta + saldo aplicado automaticamente

## O problema
Em contas com aplicação automática (ex.: "BB Rende Fácil", "Aplic Aut", CDB automático), o banco move o dinheiro parado da conta para a aplicação. O extrato mostra:
- **Saldo em conta**: R$ 1,00
- **Saldo com aplicação**: R$ 35.000,00

Se a plataforma olhar só a conta, o caixa da empresa parece zerado. Se tratar as aplicações e resgates como entradas e saídas, os números de entradas e saídas ficam inflados.

## Como vai funcionar
Cada conta terá **dois saldos**, sempre visíveis lado a lado:

```text
Conta BB Dourados
  Saldo em conta ........  R$      1,00
  Aplicação automática ..  R$ 34.999,00
  Saldo disponível total   R$ 35.000,00   <- usado no consolidado e no saldo projetado
```

1. **No cadastro da conta**: nova opção "Esta conta tem aplicação automática", com o saldo inicial da aplicação e a data.
2. **Na importação**: os lançamentos de aplicação e resgate automáticos são reconhecidos (pelas descrições do banco, com uma lista que vocês podem ajustar) e marcados como "Aplicação automática". Na conferência antes de gravar, vocês veem quais linhas foram marcadas e podem corrigir.
3. **Nos cálculos**:
   - Aplicação automática tira da conta e soma na aplicação; resgate faz o contrário. O **saldo total não muda**.
   - Esses movimentos **não entram** em "Entradas realizadas" nem em "Saídas realizadas" (igual às transferências entre contas próprias).
   - Rendimento da aplicação entra como entrada normal; IR/IOF como saída normal.
4. **Na tela**:
   - Resumo: colunas "Em conta", "Aplicado" e "Total" por conta, e total consolidado.
   - Movimentações: etiqueta "Aplicação automática" e filtro para mostrar ou esconder essas linhas (ficam escondidas por padrão, porque costumam ser muitas por dia).
   - Conciliação continua igual: essas linhas também podem ser marcadas como Conciliado ou Não se aplica, sem mudar saldo.
5. **Conferência com o banco**: quando o extrato trouxer o saldo com aplicação (OFX costuma trazer, PDF às vezes), a plataforma compara com o saldo total calculado e avisa se houver diferença, mostrando o dia em que ela começou.

## O que não muda
- Dashboard, Fluxo Diário e relatórios do cliente continuam iguais (o piloto ainda é só a aba de administradores).
- Nenhum lançamento já importado é alterado; após a mudança, vocês podem reimportar ou remarcar.

## O que preciso de vocês
- Um extrato de uma conta com aplicação automática (de preferência OFX e PDF do mesmo mês), com os dois saldos conhecidos.
- Quais bancos da Dourados têm isso e como aparece a descrição (ex.: "BB RENDE FACIL", "APLICACAO AUTOMATICA", "RESGATE AUTOMATICO").

## Detalhes técnicos
- Migration aditiva: `bank_accounts.has_auto_invest boolean default false`, `auto_invest_saldo_inicial numeric default 0`, `auto_invest_saldo_data text`; `bank_transactions.movement_kind text default 'normal'` (`normal` | `auto_aplicacao` | `auto_resgate`), com trigger permitindo alterar só `movement_kind` além da conciliação (registrado no histórico). `bank_statement_imports.saldo_aplicado_informado numeric` opcional.
- Regras de descrição configuráveis por empresa em `bank_auto_invest_patterns` (school_id, padrão), com RLS só admin.
- `bankCashflowEngine`: `accountBalances()` retorna `{ emConta, aplicado, total }`; `summarize` exclui `auto_*` de entradas/saídas como faz com `transfer_pair_id`; saldo consolidado e projetado usam `total`.
- Parsers: detectar `auto_*` por padrão de descrição; OFX lê `<AVAILBAL>`/`<LEDGERBAL>` para conferência.
- Testes: aplicação/resgate não alteram saldo total nem entradas/saídas; rendimento entra como entrada; conciliação não altera nenhum dos dois saldos; saldo total bate com o informado no extrato.
