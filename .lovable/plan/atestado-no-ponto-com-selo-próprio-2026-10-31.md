## Atestado no Ponto com selo próprio

Hoje o sistema recebe o atestado (ex.: "Atestado Médico" em 09/10, 14/10, 27/10, 28/10 e 30/10), mas mostra o dia como "Aguardando informação".

### O que muda
- Dias com atestado passam a aparecer com o selo **"Atestado"** em amarelo, na sua tela do Ponto e no "Meu ponto" de cada uma.
- Como no feriado: atestado **não conta como falta**, não entra em horas devidas, "Batidas faltando" nem "Dias com problema", e não mostra botão de justificar.
- Se a pessoa bateu ponto em parte do dia, as batidas continuam aparecendo; as horas extras (se houver) continuam contando.
- Vale para os dias já importados, sem precisar enviar o relatório de novo.

### Detalhes técnicos
- `classifyDay` em `TeamTimePanel.tsx`: novo flag `atestado` quando `ocorrencia` contém "atestado" (sem acento/maiúsculas) → `faltaDia=false`, `faltaMin=0`.
- `diaSit` e `MyTeamTimeCard`: selo "Atestado" com estilo amarelo usando token `warning` (`bg-warning/15 text-warning border-warning/30`).
- Contadores e `canJustify` ignoram dias com atestado, igual a `feriado`.
- Teste pequeno: dia com "Atestado Médico" não é falta.
