# Plano — Ler o extrato Itaú PF gerado como imagem

## O que foi confirmado
- O arquivo enviado é um PDF de 2 páginas criado por “Microsoft Print To PDF” e não possui texto interno selecionável.
- Mesmo assim, a imagem está nítida: o reconhecimento visual recuperou as datas, descrições, valores, sinais e saldos do extrato.
- Neste arquivo, a movimentação fecha exatamente: saldo anterior de **R$ 7.735,00** + lançamentos = saldo final do último dia movimentado de **R$ 22.717,57**. O cabeçalho mostra **R$ 22.719,31** em 28/09, indicando movimentação/rendimento posterior ao último lançamento exibido; essa diferença de **R$ 1,74** deve ser destacada, não escondida.

## Implementação
1. Adicionar ao leitor bancário uma segunda tentativa para PDFs sem texto: reconhecer visualmente apenas o quadro de lançamentos do extrato.
2. Criar tratamento específico e conservador para o formato Itaú mostrado neste arquivo:
   - identificar período, saldo anterior e saldos diários;
   - ler data, descrição e valor de cada lançamento;
   - preservar o sinal explícito do valor para entrada ou saída;
   - ignorar linhas de saldo como lançamentos financeiros.
3. Manter a conferência antes de gravar qualquer dado, exibindo todas as linhas reconhecidas, totais de entradas e saídas, período e saldos encontrados.
4. Validar matematicamente cada trecho pelos saldos diários do próprio extrato. Se uma linha estiver ilegível ou a conta não fechar, bloquear a confirmação e mostrar exatamente a data e a diferença.
5. Exibir separadamente a diferença entre o último saldo diário e o saldo atual do cabeçalho, deixando claro que ela não será inventada como lançamento.
6. Reutilizar a proteção existente contra duplicidade por conta, data, sentido, valor e descrição. Reenviar o mesmo PDF não duplicará lançamentos.
7. Não guardar nem exibir CPF ou outros dados pessoais reconhecidos no cabeçalho.
8. Criar testes com este formato do Itaú, incluindo sinais, saldos, diferença de R$ 1,74, arquivo repetido e falha segura quando a leitura não fechar.
9. Validar na prévia com a conta Itaú PF de Obras Nascimento, parando na conferência — sem confirmar a importação nem alterar dados financeiros.

## Limites de segurança
- Nenhuma migration ou alteração em tabelas.
- Nenhuma mudança no Dashboard, Fluxo Diário, relatórios ou histórico.
- A leitura visual será usada somente como alternativa quando o PDF não tiver texto.
- Nenhum lançamento será gravado automaticamente; continuará dependendo da aprovação na tela de conferência.
