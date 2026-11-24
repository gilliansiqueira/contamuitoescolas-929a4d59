# Wizard: ler extratos só a partir de novembro/2026

## O que muda para a equipe
- Nas três empresas Wizard (Leme, IC e SF), o início do acompanhamento passa de setembro para **novembro/2026**.
- Quando a Gisley enviar um OFX que vem desde janeiro, a plataforma grava só os lançamentos de 01/11 em diante. Os meses anteriores são ignorados, e a tela avisa quantos foram ignorados ("238 lançamentos antes de 01/11/2026 foram ignorados").
- A regra vale para todas as empresas: nenhuma importação grava lançamentos anteriores ao início do acompanhamento. Isso também evita casos como o da FourBio.

## Limpeza do que já entrou
- A Wizard IC tem 238 lançamentos **pendentes**, de 25/02 a 30/10. Eles foram trazidos pelos OFX antigos e serão apagados.
- Dois lançamentos de 31/10 **já conciliados** ficam como estão, e a equipe decide o que fazer com eles. Nada conciliado é apagado sem a sua confirmação.
- Leme e SF não têm nada antes de novembro.

## Detalhes técnicos
- `school_data_sources.start_month = '2026-11'` para as 3 Wizard.
- Edge Function `bank-statement-import`: descartar linhas com data anterior ao `start_month` da empresa antes da gravação, devolver a contagem no resultado e mostrar o aviso no diálogo de importação. Atualizar o AGENTS.md da função.
- Teste do filtro de datas, incluindo a virada de mês.
- Apagar só as linhas `pendente` com data < 2026-11-01 da Wizard IC, junto com o espelho e os vínculos, sem deixar órfãos.
