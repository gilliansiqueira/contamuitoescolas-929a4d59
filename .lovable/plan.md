# Parar a duplicação de lançamentos do Bradesco (e outros OFX)

## Causa confirmada
O Bradesco troca o código interno de cada lançamento a cada novo download do extrato. Exemplo de Manaus Laranjeiras: o Pix de TAIANE (R$ 315,00, 05/10) veio com o código N102BE no arquivo de 05/10 e com N10250 no arquivo de 07/10. O sistema confia nesse código para saber se o lançamento já existe; como o código mudou, achou que era um lançamento novo e gravou de novo.

Não é só Manaus Laranjeiras: há pares iguais vindos de arquivos diferentes em Fazenda Rio Grande, Floripa Santa Mônica, Dourados e outras empresas com Bradesco.

## O que será feito
1. **Na importação (conferência antes de importar):** além do código do banco, o sistema compara data + entrada/saída + valor + descrição com o que já está gravado na conta, vindo de outros arquivos.
   - Se o arquivo tem 1 lançamento igual e já existe 1 gravado, ele é tratado como "já existia".
   - Repetições legítimas continuam entrando: se no mesmo arquivo há 4 tarifas de R$ 1,75 no mesmo dia, entram as 4; só entra a diferença em relação ao que já existe.
   - A conferência mostra quantos foram reconhecidos assim ("já existiam, com código diferente do banco").
2. **Verificação e limpeza do que já duplicou (todas as empresas):** gerar uma planilha com todos os pares suspeitos — mesma conta, data, sentido, valor e descrição, vindos de **arquivos diferentes** — por empresa, mostrando qual está conciliado/justificado. Nada é apagado sem você aprovar a lista. Após aprovação, removo a cópia não conciliada de cada par (motivo registrado no histórico), mantendo sempre a que já tem conciliação.
3. Teste automático com o caso TAIANE/LIDIA (arquivo de 05/10 + arquivo de 07/10 = nenhum novo) e com as 4 tarifas iguais no mesmo arquivo (todas entram).

## Detalhes técnicos
- `BankAccountsImports.tsx`: ao preparar a conferência, buscar lançamentos da conta no período do arquivo; para OFX cujo `bankRef` não existe, casar por chave `data|tipo|valor|normalizeDesc` contando ocorrências (multiconjunto): novos = ocorrências no arquivo − ocorrências já gravadas de outras importações.
- Função pura nova em `parsers.ts` (`matchRenumberedRefs`) para ser testável.
- Remoção usa a RPC existente `delete_bank_tx` (registra motivo); só pares de arquivos distintos; nenhum cálculo financeiro alterado.
