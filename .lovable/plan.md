# Ajustes no relatório semestral Champagnat – 1º sem/2026

## O que muda
1. **Slide 3 (Saídas x Faturamento):** as porcentagens ficam centralizadas em cima de cada barra, com a etiqueta escura alinhada ao texto (hoje estão deslocadas para a direita e a etiqueta sai torta).
2. **Slide 13 (KPIs):** os valores ficam centralizados embaixo de cada ícone/título.
3. **Indicadores que faltavam (valores informados pela Bruna):**
   - Ticket Médio Mensal: R$ 507,02
   - Ticket Médio Semestral: R$ 3.042,15
   - Ponto de Equilíbrio: 153 alunos
   Esses valores entram no slide 13 e também no ponto de 1º sem/2026 do histórico de KPIs (slide 14). Some o aviso "Sem nº de alunos no sistema".

Nada mais no relatório é alterado.

## Detalhes técnicos
- Editar `/tmp/ch/make.py`: rótulos de % do slide 3 com `ha='center'` no centro da barra (considerando o deslocamento da face 3D) e caixa `bbox` própria do texto; slide 13 com `ha='center'` nas colunas.
- Valores fixos no script para ticket e ponto de equilíbrio (não há nº de alunos no sistema).
- Regerar `/mnt/documents/Champagnat_1_Semestre_2026.pdf` e conferir os slides 3, 13 e 14 como imagem antes da entrega.
- Nenhuma alteração no sistema.
