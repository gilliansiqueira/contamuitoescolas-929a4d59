# Atualizar a planilha de pendências de contas a pagar (setembro/2026)

Gerar uma nova versão da planilha com os dados de agora, mantendo o mesmo formato e as mesmas abas da versão anterior.

## O que muda
- Mesmas 4 abas: Resumo por empresa, Pendências detalhadas, Por responsável, Prontas para subir despesas.
- Nova aba **"O que mudou"**: comparação com a versão das 12h. Mostra, por empresa, quantas pendências tinha antes, quantas tem agora e a diferença. Também lista as empresas que zeraram e passaram a estar prontas para subir as despesas.
- Arquivo novo `pendencias_contas_a_pagar_setembro_2026_v2.xlsx`. A versão anterior continua guardada.

## Como será feito
- Mesma consulta somente leitura das saídas de setembro (01/09 a 30/09) sem conciliar, nas empresas ativas, fora a empresa restrita e a conta "Fora do banco".
- Os totais são conferidos depois do recálculo, sem erros.
- Nada é alterado no sistema.
