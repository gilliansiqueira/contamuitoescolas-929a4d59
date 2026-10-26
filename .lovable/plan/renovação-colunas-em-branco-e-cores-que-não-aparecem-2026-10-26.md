# Renovação: colunas em branco e cores que não aparecem

## O que está acontecendo
1. **Colunas em branco (Sala, Data início, Data término, Fones...)**: o sistema procura essas informações no relatório de turmas do Sponte por um nome exato (ex.: "DataInicio"). Quando o relatório vem com o nome escrito de outro jeito ("Data Início", "Fone Celular", com acento ou espaço), a coluna fica vazia. Também só preenche depois de **Recalcular planilha**.
2. **Cores das opções**: hoje a cor só é pintada na célula no momento de baixar o Excel. Quando a equipe escolhe "Renovado" ou "Follow Lançado" depois, dentro do Excel, a célula não muda de cor. O quadro de cima pega as cores porque elas são fixas.

## O que vou mudar
- **Leitura do Sponte mais tolerante**: aceitar os nomes das colunas com ou sem acento, espaço, maiúsculas (Data Início / DataInicio / Data de início etc.) para todas as colunas do modelo. O recálculo passa a acontecer sozinho quando o modelo é salvo.
- **Aviso claro**: se uma coluna marcada como "Usar" não existir no relatório enviado, a tela mostra "Sala não veio no relatório de turmas" em vez de deixar em branco sem explicação.
- **Cor automática no Excel**: as colunas Status Renovação e Situação do Contrato (e qualquer lista) ganham formatação condicional — ao escolher a opção na lista suspensa, a célula pinta com a cor configurada, e o quadro de cima conta na hora (como na planilha que vocês fizeram com o chat).
- **Na tela do sistema**: clicar na célula de Status/Situação abre as opções coloridas; ao escolher, a célula fica colorida e o quadro de renováveis / % por professor atualiza na hora.

## Detalhes técnicos
- `mergeEngine.ts`: buscar cada campo de `turmas_existentes` pelas chaves normalizadas (`norm`) usando os `aliases` de `fields.ts`, em vez de `t.Sala`, `t.DataInicio` etc. Lista de campos ausentes vira issue `coluna_ausente`.
- `exportXlsx.ts`: para cada coluna `list`, adicionar `ws.addConditionalFormatting` com regra `containsText`/`expression` (`=$X2="Opção"`) por opção usando `optionColors`; manter validação de lista. Pintura estática fica só como reforço.
- `RenewalGrid.tsx`: célula de lista com fundo pela `optionColors`; resumo já recalcula pelos overrides.
- Testes em `src/test/renewal.test.ts`: cabeçalhos com acento/espaço preenchem Sala/Data início; Excel exportado contém regras condicionais por opção.

## Preciso de você
A planilha modelo "com o check na opção" não chegou — vieram só 3 imagens. Se puder, envie o arquivo para eu copiar exatamente o funcionamento dela.
