# Priscila Barros: novo horário 9h às 18h no Ponto

## O que muda
- Gravar no cadastro da Priscila (aba Logins do Ponto) o horário corrigido: **09:00 12:00 13:00 18:00** (entrada 9h, almoço das 12h às 13h, saída 18h).
- As horas extras e atrasos dela passam a ser calculados por esse horário, com a tolerância de 10 minutos por dia de sempre.
- A próxima leitura automática do site do ponto não apaga essa correção. Quando você trocar lá também, posso remover a correção daqui (ou deixar, o resultado é o mesmo).

## Pontos de atenção
- O almoço foi suposto das 12h às 13h. Se for outro horário, me diga que ajusto.
- A correção vale para todos os dias exibidos, inclusive os anteriores à mudança. Se ela trabalhava em outro horário antes, os meses passados também serão recalculados por 9h–18h.

## Detalhes técnicos
- `team_time_employees.horario_override = '09:00 12:00 13:00 18:00'` onde `external_id = 'pf-28'` (PRISCILA BARROS DA SILVA), mesmo formato já usado na Geovanna.
- Gravação via ação super_admin já existente; sem mudança de código nem de cálculos financeiros.
- Conferir depois na tela do Ponto que as extras dela caíram.
