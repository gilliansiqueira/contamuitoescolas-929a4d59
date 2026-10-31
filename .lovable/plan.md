# Menos avisos no topo: uma barra só

## Como fica
- **Uma única barra no topo.**
  - Se houver projeção em atraso, aparece só a vermelha: "57 projeções em atraso na equipe. Faltam 6 dias para entregar o texto e o relatório (06/11)". A laranja some, porque repete o mesmo prazo.
  - Sem projeção em atraso, aparece a laranja com o prazo.
  - Nunca aparecem as duas ao mesmo tempo.
- **A etiqueta "Relatório 10/2026 · prazo 07/11 · faltam 7 dia(s)", ao lado de "Mês", sai.** Ela ainda mostrava outra data (07/11) e confundia.
- **Ao entrar na plataforma**, uma janela só com o resumo (projeções em atraso com as empresas e o prazo do relatório) e o botão "Entendi". Depois de clicar, fica só a barra lá em cima até o dia seguinte.
- **Para as meninas**, vale a mesma coisa: uma barra só, com as projeções atrasadas da carteira de cada uma, e uma janela ao entrar. A janela do "Meu Dia" (pendências e tarefas) só aparece depois que ela clicar em "Entendi" na primeira, para não abrirem duas ao mesmo tempo. O sininho no canto continua.
- A engrenagem para editar os avisos continua dentro da barra (só para você e as gestoras).

## Detalhes técnicos
- `TeamDeadlineNotice.tsx`: renderiza no máximo uma barra (vermelha se `overdue.length > 0`, senão a laranja). A parte do prazo que não é de projeção vai junto no texto da vermelha. A janela é a mesma, e o dismiss diário continua em `team_announcement_dismissals`.
- Remove o selo `dueInfo` do cabeçalho da `ManagementCenter.tsx`.
- `TeamAlerts.tsx`: a janela automática espera o dismiss do aviso de prazos no dia (lê `team_announcement_dismissals` ou um evento disparado pelo "Entendi"), para nunca abrir duas janelas juntas.
