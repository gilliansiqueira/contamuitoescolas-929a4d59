# Farmácia (previsão de outubro) e Vitória (extrato PicPay em PDF)

## Farmácia Magistral: por que outubro não aparece
- A planilha "Entrada Prevista Outubro" tem as datas em **2024** (01/10/2024 a 31/10/2024), e não em 2026.
- Ela foi importada hoje às 12:33 assim mesmo: 21 lançamentos que somam R$ 965.092,03, todos em outubro de 2024. Por isso não aparecem em outubro de 2026.
- O valor por dia também está estranho: R$ 45.956,76 com muitas casas decimais, o que parece resultado de fórmula. Vale a equipe conferir se esse é o valor certo.

**O que será feito**
1. Apagar esse envio de outubro de 2024 (os 21 lançamentos saem junto) e reimportar a mesma planilha trocando o ano para 2026. As datas e os valores continuam iguais aos da planilha.
2. Criar uma proteção na importação de projeções: se a maioria das datas estiver mais de 6 meses antes do mês atual, aparece o aviso "As datas estão em 2024. Confira o ano antes de importar", e é preciso confirmar para seguir.

## Vitória: extrato do PicPay em PDF
- O PDF tem texto (não é imagem), mas o sistema não conhece o formato do PicPay.
- Formato do PicPay: um bloco por dia ("02 de outubro 2026 — Saldo ao final do dia"), com Hora, Tipo, Origem/Destino e Valor (+R$ recebido, −R$ enviado). O saldo final do período aparece no topo.

**O que será feito**
3. Criar um leitor do PDF do PicPay:
   - o sentido vem do próprio sinal impresso pelo banco ("+R$" ou "−R$"), que é o indicador de crédito ou débito do extrato;
   - nomes quebrados em duas linhas são juntados;
   - quando o mesmo dia se repete no começo de outra página, o cabeçalho repetido é ignorado.
4. Conferência: cada dia precisa fechar com o "Saldo ao final do dia", e o último dia com o saldo final do período. Se não fechar, a importação fica bloqueada e o sistema mostra o dia com diferença.
5. Testar com o arquivo enviado (05/09 a 04/10, saldo final R$ 1.087,34).

## Pinheirinho
A leitura da planilha já está corrigida, mas só chega ao site depois de publicar. Se for o caso, posso publicar junto com estas correções.

## Detalhes técnicos
- Farmácia: `financial_entries` com `source_kind='import'`, `data` entre 2024-10-01 e 2024-10-31, criado em 05/10/2026. A exclusão será feita pelo upload (`origem_upload_id`), para não deixar registros órfãos. A reimportação mantém a rastreabilidade (`origem_upload_id`, `source_kind`, `source_file`, `imported_at`).
- O aviso de ano fica na etapa de conferência do upload de projeções (`FileUpload.tsx`).
- PicPay: novo `parsePicPayText` em `parsers.ts`, detectado pelo texto "PicPay Serviços" + "Saldo ao final do dia". O saldo anterior é calculado assim: saldo do fim do primeiro dia menos os lançamentos desse dia. Teste com fixture em `src/test/`.
- Nada muda na classificação nem nos motores SSOT.
