# Ather – Itaú: aviso de diferença falso na conferência do extrato

## O que encontrei
- O extrato está **certo** e bate com o sistema: saldo da plataforma em 31/10 (−R$ 20.673,79) + movimento de novembro no arquivo (+R$ 6.248,90) = **−R$ 14.424,89**, exatamente o saldo do banco.
- O erro está só no aviso da tela de conferência: para calcular o "saldo em conta", a tela lê os lançamentos já gravados, mas o sistema entrega no máximo 1.000 por vez. O Itaú da Ather tem 1.226 desde o saldo inicial, então parte deles ficava de fora e aparecia uma diferença de R$ 1,97 milhão que não existe.
- Pode acontecer em qualquer conta com mais de 1.000 lançamentos.

## O que vou fazer
1. Corrigir o cálculo para ler **todos** os lançamentos gravados (em páginas), em todas as empresas.
2. Conferir com o seu arquivo que o aviso some e o saldo calculado fica em −R$ 14.424,89.
3. Depois disso a equipe pode confirmar a importação normalmente (25 lançamentos novos de 24 e 25/11). Se quiser, pode confirmar já agora: o aviso é falso e nada fica errado.

## Detalhes técnicos
- `src/components/fluxo-bancario/BankAccountsImports.tsx` (~linha 294): trocar a consulta com `.limit(20000)` por `fetchAllRows` (`src/lib/fetchAll.ts`), mantendo os mesmos filtros (`account_id`, `is_forecast=false`, `data <= periodoFim`, `data > saldo_inicial_data`).
- Sem mudança em dados, valores ou regras financeiras.
