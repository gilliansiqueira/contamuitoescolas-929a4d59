## Planilha da folha para a contabilidade, gerada pelo Ponto

O botão novo **"Planilha da contabilidade"** fica no Ponto. A pessoa escolhe o mês e baixa o mesmo modelo .xls que a contabilidade já recebe: Código Empresa 134, CNPJ, competência e as mesmas colunas e códigos (150, 200, 204, 8792, 8794, 248, 232, 260, 999).

### O que é preenchido sozinho
- **Horas extras 50% (150):** soma das extras do mês, sem contar domingos e feriados.
- **Horas extras 100% (200):** horas trabalhadas em domingos e feriados.
- **Atraso (204):** minutos de atraso ou saída antes no mês. É a mesma conta que já aparece na tela.
- **Dias de falta (8792) e DSR (8794):** faltas sem justificativa aceita. Feriado e atestado não contam como falta.
- **VR (248):** cada pessoa tem um valor fixo cadastrado, que se repete todo mês. Os valores de partida vêm de setembro. A **Priscila passa a ter R$ 80,00**, por ter mudado para 8 horas.
- **Plano de saúde e plano odontológico (mensalidade, coparticipação e odontológico 232):** vêm do documento das operadoras enviado no mês (veja abaixo). Se nenhum documento for enviado, a planilha repete os valores do mês anterior.
- **Adiantamento (260) e Outros (999):** ficam para preencher à mão na tela antes de baixar.

Antes de baixar, aparece uma tabela para conferir e corrigir. Toda correção feita à mão fica salva naquele mês.

### Envio do documento dos planos
- Na mesma tela, há o botão **"Enviar fatura do plano"**. Ele lê o PDF ou a planilha da operadora e liga cada valor à pessoa pelo nome.
- Quando um nome não for encontrado, aparece um aviso para escolher a pessoa. O sistema nunca chuta o vínculo.
- **Preciso de um exemplo** da fatura do plano de saúde e da do odontológico para montar essa leitura. Até lá, os valores podem ser digitados na tabela.

### Quem acessa
Só você e quem já pode ver o Ponto. A tela não mexe em nenhum cálculo financeiro das escolas.

### Detalhes técnicos
- Novas tabelas `team_payroll_defaults` (external_id, vr, saúde, odonto) e `team_payroll_month` (mês, external_id, campos, overrides, origem do upload). RLS: leitura com `can_view_team_time()`, escrita só com `is_super_admin()`.
- Os valores iniciais de VR e planos vêm da planilha de setembro, com a Priscila em 80. As pessoas são ligadas pelo código da folha (coluna "Código Folha"), cadastrado em `team_time_employees`.
- `src/lib/teamTime/payroll.ts` é uma função pura que monta as linhas a partir do `classifyDay` (reaproveita feriado e atestado). Testes cobrem extras 50%/100%, atestado fora da falta e VR da Priscila = 80.
- A geração do .xls usa o modelo enviado como base, para manter o layout. O arquivo sai como xlsx compatível, com o mesmo cabeçalho.
- A leitura das faturas fica para uma segunda etapa, quando os exemplos chegarem.
