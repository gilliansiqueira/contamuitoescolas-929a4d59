# Farmácia Magistral: despesas por área, novos indicadores e ícones

## O que encontrei
- Os indicadores da farmácia são 19 tipos de fórmula (Cápsula, Creme, Xarope, Envelope...) e **nenhum tem ícone**. Por isso aparecem sem imagem.
- A farmácia ainda não tem nenhuma área de despesa cadastrada.
- Os dois relatórios de CMV de outubro/2026 batem com o total de cada página:
  - Loja (filial 0002-NOVA): varejo R$ 15.046,80 + requisições R$ 246.925,20 = **R$ 261.972,00**
  - Veterinária (filial 0020-MGT Laboratório): **R$ 32.427,31**

## 1. Despesas agrupadas por área
- Vou criar as áreas da farmácia: **Atendimento, Laboratório, Administrativo e Comercial**. Você pode trocar essa lista.
- Cada despesa vai para uma área. A ligação é feita pelo item do modelo e vale para os meses seguintes.
- O relatório mostra o total de cada área, com as despesas dela, e o peso de cada área sobre a receita.
- Os totais de despesa continuam vindo do mesmo cálculo de hoje. O agrupamento só organiza a apresentação, então os números não mudam.

## 2. Novos indicadores
- **CMV do mês**, em R$, separado em Loja e Veterinária, mais o total.
- **CMV sobre faturamento**, em %, calculado com o faturamento já cadastrado.
- **CMV por tipo de fórmula**, com quantidade e valor de cada uma (Cápsula, Creme...), para Loja e Veterinária.
- **Estoque em R$**, por filial. Para isso preciso do relatório de posição de estoque.
- **Envio do relatório de CMV**: você manda o PDF, eu mostro a conferência (linhas, quantidades e totais por bloco) e só gravo quando a soma das linhas bate com o TOTAL GERAL. Se não bater, a gravação fica bloqueada e eu mostro quais linhas causam a diferença.
- Já gravo outubro/2026 com os dois PDFs que você enviou.

## 3. Ícones
- Vou criar um ícone para cada tipo de fórmula, no mesmo estilo dos atuais: cápsula, frasco de creme, gota/loção, shampoo, comprimido, xarope, envelope, biscoito, pastilha, patch, filme, pasta, solução e pomada.
- Vou ligar esses ícones aos 19 indicadores da farmácia. Os novos indicadores (CMV, estoque) também vão ganhar ícone.

## Detalhes técnicos
- Áreas: reaproveitar `expense_detail_groups`/`expense_detail_items` (escopo `school_id`), ligadas a `model_item_id`. É só leitura sobre o resultado do `buildMonthMovement`, sem recálculo fora da SSOT.
- CMV: nova tabela `pharmacy_cmv_monthly` (school_id, month, filial, bloco, tipo, quantidade, valor, upload_id), com rastreabilidade e exclusão em cascata pelo upload. RLS is_admin + RESTRICTIVE `can_see_school`, e cliente da empresa só lê. O parser fica puro e testado em `src/lib/cmvReportParse.ts`.
- Estoque: tabela `pharmacy_stock_monthly` (month, filial, valor), aguardando o formato do relatório.
- Ícones: gerados em PNG transparente, enviados para `icons_library`, com `kpi_definitions.icon_id` atualizado.
- Os indicadores de CMV ficam fora do Resultado e do Caixa: são informativos.

## Preciso de você
- Confirmar ou ajustar as áreas.
- Mandar o relatório de estoque.
- Dizer se você também quer o CMV por tipo para a Veterinária ou só o total dela.
