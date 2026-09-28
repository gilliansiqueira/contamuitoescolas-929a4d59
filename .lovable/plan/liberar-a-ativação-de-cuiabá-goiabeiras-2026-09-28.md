# Liberar a ativação de Cuiabá Goiabeiras

## Diagnóstico confirmado

O botão continua bloqueado porque a conferência exige que não exista nenhuma movimentação em **“A classificar”**. Hoje há sete:

- Seis são três transferências entre Sicredi e Stone, com valores e datas correspondentes: **R$ 1.451,52**, **R$ 677,60** e **R$ 6.291,05**. Elas estão marcadas como transferência, mas ainda não foram vinculadas em pares.
- Uma é a parte de **R$ 10.171,63** da fatura de **14/09**, já marcada como **Operação**. A sincronização atual transforma partes de Operação sem categoria contábil em “A classificar”, embora Operação não deva exigir classificação de Receita ou Despesa.

A diferença final de **R$ 9,71** já está dentro da tolerância global de R$ 10,00 e, sozinha, não bloqueia a ativação.

## Correção

1. Ajustar a sincronização central para que uma parte marcada como **Operação** seja gerada como Operação, e não como “A classificar”.
2. Vincular automaticamente as três transferências correspondentes entre Sicredi e Stone, tornando-as neutras no consolidado.
3. Ressincronizar Cuiabá Goiabeiras e confirmar que os sete itens deixam de aparecer como “A classificar”.
4. Abrir a conferência na prévia e validar que o botão **Aprovar e ativar** fica disponível, mantendo os R$ 9,71 como “a confirmar no próximo extrato”.
5. Adicionar uma verificação automática para impedir que partes de Operação voltem a bloquear ativações em qualquer empresa.

## Segurança financeira

- Nenhum valor, data ou lançamento bancário será removido ou alterado.
- Transferências próprias continuarão afetando apenas cada conta, sem impacto no consolidado.
- Operações continuarão afetando somente o Caixa, nunca Receita, Despesa ou Resultado.
- A correção da sincronização valerá para todas as empresas; o ajuste dos pares existentes será feito apenas em Cuiabá Goiabeiras.
