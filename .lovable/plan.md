## Planilha da folha para a contabilidade, gerada pelo Ponto

O botão novo **"Planilha da contabilidade"** fica no Ponto. Você escolhe o mês e baixa o mesmo modelo que a contabilidade já recebe: Código Empresa 134, CNPJ, competência e as mesmas colunas e códigos (150, 200, 204, 8792, 8794, 248, 232, 260, 999).

### O que é preenchido sozinho
- **Horas extras 50% (150):** extras do mês feitas em dias normais.
- **Horas extras 100% (200):** horas trabalhadas em domingos e feriados.
- **Atraso (204):** atrasos e saídas antes da hora no mês. É a mesma conta que já aparece no Ponto.
- **Dias de falta (8792) e DSR (8794):** faltas sem justificativa aceita. Feriado e atestado não contam como falta.
- **VR (248):** cada pessoa tem um valor fixo, que se repete todo mês. Os valores de partida são os de setembro. A **Priscila passa a ter R$ 80,00**.
- **Plano odontológico (232):** repete o valor do mês anterior. Para começar, uso os valores de setembro.
- **Adiantamento (260) e Outros (999):** você preenche na tela antes de baixar.

### Plano de saúde, pelo relatório da operadora
Na mesma tela, há o botão **"Enviar relatório do plano"**, que aceita os dois relatórios que você mandou (mensalidade e coparticipação).
- **Mensalidade do titular:** a funcionária paga 40%, porque a empresa arca com 60%. Por exemplo, a Fernanda tem plano de R$ 223,77 e paga R$ 89,51, o mesmo valor de setembro.
- **Mensalidade dos dependentes:** a funcionária paga 100%. Por exemplo, o Theo, filho da Franciliane, sai por R$ 201,60, também igual a setembro.
- **Coparticipação (consultas e exames):** a funcionária paga 100%, separando titular e dependente.
- **Como cada valor chega à pessoa:** pelo nome. A matrícula do relatório não bate com o código da folha (por exemplo, Franciliane é 5 no plano e 12 na folha).
- **Nomes que não estão na folha** (como o seu) ficam de fora e aparecem listados. Quando um nome é parecido, mas não idêntico, aparece um aviso para escolher a pessoa. O sistema nunca chuta.
- **Competência:** o relatório de coparticipação que você enviou é de 08/2026 e tem R$ 57,79 da Gisele. Na planilha de setembro, a coparticipação dela ficou em branco. Vou mostrar qual competência entrou e deixar você confirmar.

Antes de baixar, aparece uma tabela para conferir e corrigir. Toda correção feita à mão fica salva naquele mês.

### Quem acessa
Só você e quem já pode ver o Ponto. A planilha não mexe em nenhum cálculo financeiro das escolas.

### Detalhes técnicos
- **Tabelas novas:**
  - `team_payroll_defaults`: valores fixos por pessoa (external_id, código folha, vr, odonto).
  - `team_payroll_month`: valores do mês (external_id, campos, overrides, upload de origem).
  - `team_payroll_uploads`: relatórios enviados, com rastreio.
  - RLS: leitura com `can_view_team_time()`, escrita só `is_super_admin()`. GRANTs incluídos.
- **Valores iniciais:** VR, odonto e código folha vêm da planilha de setembro, com Priscila = 80.
- **`src/lib/teamTime/payroll.ts` (pura):**
  - monta as linhas a partir do `classifyDay`, reaproveitando feriado e atestado;
  - `parseRel0051` lê o relatório da operadora, que é HTML; o "Valor Unitário" vem em centavos;
  - Titular × 0,40 com arredondamento em centavos; Dependente × 1; coparticipação × 1.
- **Testes:** Fernanda 223,77 → 89,51; Franciliane 301,09 → 120,44 + dependente 201,60; atestado não vira falta; VR da Priscila = 80.
- **Exportação:** xlsx no mesmo layout do modelo (cabeçalho, linhas 9–10 com códigos, uma linha por pessoa).
