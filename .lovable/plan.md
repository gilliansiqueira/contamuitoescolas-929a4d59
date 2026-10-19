# Planilha DRE Simples – Champagnat

## O que será entregue
Uma cópia da planilha com a primeira aba ("DRE Simples") preenchida com os dados da Champagnat. O layout, as fórmulas e as cores do modelo não mudam. A aba "Metas Mensais" fica como está. Nada muda no sistema.

## De onde vêm os números
- **Número de alunos:** 135 (valor que você passou).
- **Ticket médio mensal:** a receita do último mês fechado dividida por 135. Se você preferir usar os R$ 507,02 do relatório semestral, é só avisar.
- **Impostos, inadimplência e marketing (%):** a proporção de cada um sobre a receita do último mês fechado. A inadimplência vem do indicador do mês.
- **Despesas fixas e folha:** os valores do último mês fechado, encaixados em cada linha do modelo (aluguel, energia, internet, contador, software, instrutores, coordenação, pró-labore etc.). O que não tiver linha própria entra em "Outras despesas fixas".
- **Provisões de férias/13º e FGTS:** continuam como percentuais do modelo (8,33% e 8%), a não ser que o mês tenha esses valores lançados.
- **Ponto de equilíbrio, lucro e lucratividade:** as fórmulas da planilha calculam sozinhas.

## O que fica em aberto
- **Metas (Primeira, Segunda e Terceira):** ficam em amarelo e em branco, esperando a resposta do cliente.
- Toda linha sem valor no sistema fica marcada, e eu te passo a lista na entrega para você completar.

## Detalhes técnicos
- Último mês com Relatório Realizado fechado da escola `992d3914…`. Totais tirados de `realized_entries`/`historical_monthly`, sem recalcular por regra própria.
- Edição com openpyxl em cima do arquivo original; fórmulas recalculadas com LibreOffice; nenhum erro de fórmula.
- Saída: `/mnt/documents/DRE_Champagnat.xlsx`.
