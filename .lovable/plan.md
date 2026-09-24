# Central de Clientes igual ao exemplo compacto

## Objetivo
Reproduzir a composição visual do arquivo enviado na Central da proprietária e da equipe, mantendo dados, filtros, ações e permissões reais.

## Layout
- Aplicar a moldura compacta do exemplo: menu lateral estreito em laranja, área principal cinza-clara, painéis brancos, tipografia leve e espaçamentos densos.
- Usar a logo Conta Muito no topo e o perfil no rodapé do menu, com nome/e-mail real e identificação de proprietária ou equipe.
- Mostrar o mesmo menu para proprietária e administradoras: **Carteira de clientes**, **Fechamentos**, **Pendências** e **Por responsável**.
- Manter a adaptação do exemplo: menu reduzido em telas médias e navegação apropriada no celular, sem rolagem lateral difícil de usar.
- Preservar modo claro e noturno com os equivalentes visuais apresentados no arquivo.

## Tela principal
- Reproduzir o cabeçalho com título, texto de apoio, período e botão **Nova empresa**.
- Exibir **Nova empresa** somente para a proprietária e conectá-lo ao cadastro de empresa já existente; a equipe não verá esse botão.
- Organizar quatro cartões como no exemplo:
  - Empresas ativas;
  - Atualizadas hoje;
  - Conciliação pendente, informando também quantas estão concluídas;
  - Fechamento pendente, informando também quantos relatórios foram entregues.
- Manter busca e situação na faixa compacta acima da lista.
- Converter a listagem para as colunas do exemplo: empresa, responsável, atualizado até, andamento, situação e ação **Abrir**.
- O andamento usará somente percentuais reais já disponíveis; quando não houver etapas, mostrará **Configurar etapas** ou **Indisponível**, sem criar percentual.
- Criar o painel **Prioridades de hoje** apenas com situações reais da carteira, como empresas atrasadas, aguardando cliente, pendências e próximas ações cadastradas. Nenhum alerta fictício será exibido.

## Proprietária e equipe
- A proprietária verá toda a carteira, poderá definir responsáveis, editar nomes exibidos e cadastrar nova empresa.
- Cada administradora verá o mesmo layout e somente as empresas autorizadas para seu login, conforme a filtragem protegida já existente.
- A equipe não poderá cadastrar empresa, trocar responsáveis ou editar nomes.
- Clientes continuarão fora desta Central: uma empresa abre direto no Dashboard; múltiplas empresas mantêm a seleção simples.

## Demais visões
- **Fechamentos** e **Pendências** reutilizarão a mesma composição compacta e os filtros existentes.
- **Por responsável** manterá os cartões, anéis, nomes editáveis e expansão já aprovados, recebendo apenas a mesma identidade compacta do exemplo.
- Não serão adicionadas ações de notificações, prioridades ou configurações sem função real.

## Preservações
- Nenhuma alteração em cálculos financeiros, motores oficiais, Dashboard, PDFs, relatórios, gráficos, importações ou dados.
- Conciliação concluída continuará disponível no resumo, incorporada à observação do cartão de conciliação para respeitar a composição de quatro cartões do exemplo.
- Situações, percentuais e responsáveis continuarão vindo das fontes atuais; nada será inferido pelo sinal dos valores.

## Validação
- Conferir a proprietária com carteira completa, botão **Nova empresa**, seleção de responsável e edição de nome.
- Conferir uma administradora com a mesma tela, carteira restrita e sem ações exclusivas da proprietária.
- Validar menu, busca, período, situação, abertura de empresa e as quatro visões.
- Conferir computador, tela média e celular nos modos claro e noturno.
- Confirmar que os totais exibidos continuam iguais aos dados atuais e que nenhum relatório ou cálculo financeiro foi alterado.

## Reversão
A mudança ficará concentrada na apresentação da Central; o cadastro existente e as consultas protegidas serão reutilizados, sem mudança estrutural nos dados.
