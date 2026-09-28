# Central de Clientes: cores da conciliação e horário da última alteração

## Resultado esperado
- Ao lado de cada empresa, a bolinha mostrará o estado **da conciliação bancária**: **verde** quando os lançamentos do dia de referência estiverem conciliados; **amarela** quando ainda houver pendência apenas do dia; **vermelha** quando houver lançamento pendente de **dia anterior** ou **extrato do dia de referência não enviado**, mesmo que o dia atual esteja 100% conciliado.
- Se a empresa não tiver informação bancária suficiente para avaliar a conciliação, usar uma bolinha neutra com indicação “Indisponível”, sem sugerir que esteja em dia ou atrasada.
- A cor terá descrição acessível ao passar o cursor e para leitores de tela. Não mudar a etiqueta atual de “Situação”, que também representa etapas e fechamento do mês.

## Última alteração
- O horário exibido deve refletir também ações registradas depois da importação, como conciliar lançamentos e outras alterações rastreadas, sem confundir a data do lançamento com a data da ação.
- No caso conferido da Ather, havia conciliação registrada aproximadamente um minuto antes da consulta, mas a coluna considerava apenas registros criados cerca de cinco horas antes. A coluna passará a buscar o registro de atividade mais recente e a atualizar automaticamente enquanto a Central estiver aberta.
- O indicador mostrará a **última ação salva**, não a presença de uma pessoa apenas navegando ou digitando sem salvar. A atualização periódica pode ter pequeno atraso; não prometer acompanhamento instantâneo de ações não registradas.

## Implementação técnica
- Ajustar apenas a apresentação na Central de Clientes, usando os dados diários e a lista de pendências acumuladas já consultados pela tela. Prioridade: pendência anterior ou extrato não enviado (vermelho) > pendência somente do dia (amarelo) > dia conciliado (verde) > indisponível. Distinguir empresas sem Fluxo Bancário de empresas que deveriam enviar extrato, para não marcar ausência de dados como atraso.
- Aplicar a mesma regra à lista principal e às empresas expandidas em “Por responsável”, com cores semânticas existentes; manter a interpretação da bolinha consistente em Hoje, Dia anterior e Mês, tomando como referência a conciliação diária exibida.
- Conferir os casos de 100% hoje com pendências antigas, pendência só de hoje, extrato não enviado, dia conciliado sem pendências e empresa sem Fluxo Bancário, inclusive no celular. Nenhum cálculo financeiro ou dado bancário será alterado.
- Atualizar a consulta da última atividade por migração, acrescentando conciliações e demais ações com carimbo de tempo confiável; atualizar a consulta da carteira automaticamente em intervalos curtos e após ações feitas na tela. Verificar os horários no fuso de São Paulo e reproduzir o caso da Ather antes/depois. Sem mudar dados financeiros.
