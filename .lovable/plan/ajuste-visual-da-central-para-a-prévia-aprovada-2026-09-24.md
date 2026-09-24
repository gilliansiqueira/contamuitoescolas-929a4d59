# Ajuste visual da Central para a prévia aprovada

## Objetivo
Deixar a Central de Gestão visualmente igual à prévia anterior aprovada, sem alterar cálculos, dados, PDFs, relatórios ou regras de acesso.

## Mudanças visuais
- Reproduzir a composição da prévia: título “Central de Clientes”, conteúdo mais largo, cinco cartões principais em uma única linha no desktop e tabela compacta com cabeçalho fixo e colunas bem definidas.
- Usar o menu lateral laranja da prévia, com logo completo, ícones e item selecionado em creme; manter a versão laranja queimado no modo noturno.
- Organizar busca e filtros em uma única faixa acima da tabela.
- Exibir na tabela: empresa, responsável, período, atualização, conciliação, fechamento, pendências, situação e ações.
- Aplicar barras de progresso e situações com cores semânticas, mostrando “Sem acompanhamento” quando não houver fonte real para o cálculo.
- Melhorar densidade, alinhamento, respiro, tipografia e contraste nos modos claro e noturno.
- Adaptar para telas menores sem criar rolagem lateral difícil de usar.

## O que será preservado
- A Central completa continua exclusiva do proprietário (`super_admin`).
- A equipe administrativa continua vendo somente a carteira permitida e simplificada.
- Clientes continuam entrando diretamente no Dashboard ou na seleção simples de empresas autorizadas.
- O conteúdo do menu continuará respeitando a separação já definida; a prévia será referência de aparência e organização, não de permissões ou funcionalidades fictícias.
- Nenhum valor será inventado: cartões, percentuais, responsáveis, pendências e situações usarão apenas fontes reais; ausência de fonte será sinalizada claramente.
- PDFs, relatórios, cards internos das empresas, indicadores, gráficos, importações e motores financeiros não serão alterados.

## Implementação
- Refatorar apenas a apresentação da Central de Gestão e usar os tokens visuais globais já existentes.
- Substituir a lista atual pelo formato tabular da prévia, mantendo as ações existentes de acesso às empresas.
- Preservar os filtros atuais e reorganizá-los no novo formato; visões do proprietário continuarão filtrando os mesmos dados reais.
- Remover textos auxiliares técnicos da tela e manter somente informações úteis para a operação.

## Validação
- Conferir com acesso de proprietário nos modos claro e noturno.
- Conferir a experiência simplificada de administrador e o isolamento completo dos clientes.
- Validar busca, filtros, troca de período e abertura de empresa.
- Comparar visualmente o resultado final com as duas prévias aprovadas.
- Confirmar que nenhum arquivo de PDF, relatório ou cálculo financeiro foi alterado.

## Reversão
A mudança ficará isolada na apresentação da Central; se necessário, o componente visual anterior poderá ser restaurado sem migração ou alteração de dados.
