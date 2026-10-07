# Renovação escolar: guiar o passo a passo na tela

## Problema
Bruna não conseguiu descobrir como gerar a planilha de Vitória. O fluxo existe (Modelo → Relatórios → Conferência → Planilha → Envios), mas a tela não orienta: as etapas 2–5 ficam desabilitadas sem explicação e nada indica o próximo passo.

## O que muda (somente tela, sem mexer em cálculos nem dados)

### 1. Faixa "Próximo passo" no topo da escola
Em `SchoolRenewal`, uma faixa de orientação sempre visível dizendo o que fazer agora, conforme o estado:
- Sem planilha criada: "Digite o período (ex.: 2027/1) e clique em Criar para começar."
- Planilha criada, sem importações: "Etapa 2: envie os relatórios do Sponte (Turmas Existentes e Contas a Receber)." + botão "Ir para Relatórios".
- Importações feitas, pendências abertas: "Etapa 3: confira N itens antes de usar a planilha." + botão "Ir para Conferência".
- Tudo conferido: "Etapa 4: a planilha está montada. Ajuste e baixe o Excel." + botão "Ir para Planilha".
- Planilha com linhas e sem envio: "Etapa 5: registre o envio ao cliente para guardar a versão." + botão "Ir para Envios".

### 2. Dicas nas abas desabilitadas
- Quando as etapas 2–5 estiverem bloqueadas (sem planilha), mostrar ao lado das abas um texto curto: "Crie a planilha do período para liberar as próximas etapas."
- Tooltip/título nas abas desabilitadas explicando o motivo.

### 3. Rótulos mais claros
- Botão "Criar" → "Criar planilha do período".
- Na etapa 2, quando não houver importação ainda, texto de destaque: "Envie primeiro o relatório de Turmas Existentes; depois o de Contas a Receber."

## Arquivos
- `src/components/renovacao/RenovacaoModule.tsx` — faixa de próximo passo, dicas nas abas, rótulos.

## Fora de escopo
- Nenhuma mudança em regras de cálculo, importação, banco de dados ou permissões.
