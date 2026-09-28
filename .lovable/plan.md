# Bolinha de conciliação na Central de Clientes

## Resultado esperado
- Ao lado de cada empresa, a bolinha mostrará o estado **da conciliação bancária**: **verde** quando os lançamentos do dia de referência estiverem conciliados; **amarela** quando ainda houver pendência do dia ou o extrato estiver por enviar; **vermelha** quando houver lançamento pendente de **dia anterior**, mesmo que o dia atual esteja 100% conciliado.
- Se a empresa não tiver informação bancária suficiente para avaliar a conciliação, usar uma bolinha neutra com indicação “Indisponível”, sem sugerir que esteja em dia ou atrasada.
- A cor terá descrição acessível ao passar o cursor e para leitores de tela. Não mudar a etiqueta atual de “Situação”, que também representa etapas e fechamento do mês.

## Implementação técnica
- Ajustar apenas a apresentação na Central de Clientes, usando os dados diários e a lista de pendências acumuladas já consultados pela tela. Prioridade: pendência anterior > pendência do dia/extrato ausente > dia conciliado > indisponível.
- Aplicar a mesma regra à lista principal e às empresas expandidas em “Por responsável”, com cores semânticas existentes; manter a interpretação da bolinha consistente em Hoje, Dia anterior e Mês, tomando como referência a conciliação diária exibida.
- Conferir os casos de 100% hoje com pendências antigas, pendência só de hoje, extrato ausente, dia conciliado sem pendências e empresa sem dados bancários, inclusive no celular. Nenhum cálculo financeiro ou dado bancário será alterado.
