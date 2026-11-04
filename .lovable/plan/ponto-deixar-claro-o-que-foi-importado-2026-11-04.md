# Ponto: deixar claro o que foi importado

## O que aconteceu (conferido no arquivo)
- O PDF enviado **não é só de ontem e hoje**: todas as 38 páginas dizem "Período de 01/10/2026 à 03/11/2026" (gerado em 03/11 às 18:50).
- Ele tem 19 pessoas. Os "456 dias" não são dias do calendário: é a **soma dos dias de todas as pessoas juntas** (ex.: 19 pessoas × cerca de 24 dias com marcação).
- Ou seja, o arquivo não foi gerado errado e a leitura não errou — o período só veio maior do que você pensava, e a mensagem é confusa.
- Reimportar um período que já existe substitui os mesmos dias; não duplica horas.

## O que vou mudar
1. **Janela de conferência** (antes de gravar): mostrar em destaque "Período do relatório: 01/10/2026 a 03/11/2026 (34 dias)" e, se o período tiver mais de 7 dias, um aviso: "Este relatório cobre X dias. Se você queria só alguns dias, gere de novo no sistema de ponto escolhendo as datas."
2. **Coluna "Dias"** da tabela por pessoa passa a se chamar "Dias com registro".
3. **Mensagem depois de gravar**: em vez de "456 dias", mostrar "Ponto importado: 19 pessoas, período 01/10 a 03/11/2026 (456 dias-pessoa registrados)".

Nada muda nos cálculos de horas, extras, faltas ou na planilha da folha.

## Detalhes técnicos
- Só `src/components/team/ImportCartaoPonto.tsx`: usar `rep.periodoInicio`/`rep.periodoFim` já lidos pelo `cartaoPontoParser.ts`; calcular dias corridos do período; aviso quando > 7; texto do `toast.success` com período + `r.counts`.
