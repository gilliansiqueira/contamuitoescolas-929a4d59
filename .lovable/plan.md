# Renovação: montar o modelo na tela (sem subir arquivo)

## Ideia
Em vez de enviar o Excel do modelo, cada escola monta o seu modelo numa tela simples, uma vez só. Depois é só reaproveitar (ou copiar de outra escola).

## Tela "Modelo da escola" (dentro de Renovação)
1. **Lista de colunas** com todas as 28 do Sponte + as da equipe (Turma, Curso, Estágio, Professor, Sala, Modalidade, Data início/término, Integrantes, Aluno, Matrícula, Fones, Bolsa, Término contrato, E-mail, Nº contrato, Situação aluno, Venc. última parcela, Status Renovação, Situação do Contrato, Teacher, Turma de destino, Forma de pgto, Data pgto, Data remat., Observações).
2. Em cada coluna: caixinha **Usar / Não usar**, **nome editável**, setas **subir/descer** (ou arrastar) e número da posição.
3. Botão **+ Nova coluna** (nome e tipo: texto, data, número ou lista de opções).
4. **Listas com cores**: para Status Renovação e Situação do Contrato (e qualquer coluna de lista), editar opções e escolher a cor de cada uma — como no quadro enviado (Renovado azul, Pendente laranja, Aguardando retorno cinza, Não rematriculará vermelho; Follow lançado, Planejamento enviado... com suas cores). Marcar quais opções **contam como renovado**.
5. **Cor do título** das colunas.
6. Botão **Copiar modelo de outra escola** e **Pré-visualizar**.
7. Ao salvar, a planilha 2027/1 já passa a usar o modelo; correções da equipe continuam.

## Excel exportado
- Colunas na ordem e com os nomes escolhidos; colunas desmarcadas ficam de fora.
- Cada célula de Status/Situação pintada com a cor da opção; listas suspensas com as opções.
- **Quadro no topo**: Status (qtd. por opção) e Situação (qtd. por opção) com as mesmas cores.
- **Por professor**: renováveis, renovados e % de renovação, incluindo "Sem professor", e **linha Total** com renováveis e % geral.

## Na tela
Quadro fixo acima da planilha: total de renováveis, renovados, % total e tabela por professor.

## O envio de arquivo
Fica como opção secundária ("importar de um Excel"), só para preencher a tela automaticamente — não é mais obrigatório.

## Detalhes técnicos
- Reaproveita `renewal_templates.structure.columns` (`RenewalColumn`): adicionar `optionColors: Record<string,string>` e `renewedOptions: string[]`; `hidden` = não usar. Sem mudança no banco.
- Novos campos no catálogo `fields.ts`: sala, data_inicio, data_termino, fone_residencial, fone_celular, bolsa, email, situacao_aluno, teacher, data_pagamento (vindos de `turmas_existentes`).
- Componente novo `TemplateBuilder.tsx`; `exportXlsx.ts` usa optionColors e renewedOptions; `isRenewed` passa a considerar renewedOptions quando definido.
- Testes: ordem/ocultas na exportação, contagem por professor e total com opções personalizadas.
