# Visão das meninas na Central: aba "Meu ponto", Meu Dia em cards e sem "Sem Fluxo Bancário"

## O que muda para a equipe (quem não é proprietária)

```text
Menu lateral da Central (equipe)
  Carteira de clientes | Relatórios | Pendências | Meu ponto   <- "Por responsável" sai para elas
```

1. **Aba "Meu ponto" no lugar de "Por responsável"**
   - Só aparece para quem tem login vinculado a um funcionário. Você (proprietária) continua vendo "Por responsável" e "Ponto da Equipe" como hoje.
   - O cartão "Meu ponto" sai do topo da Central e passa a morar só nessa aba, para ficar claro que é algo separado do trabalho com as empresas.
   - Conteúdo da aba:
     - Quatro cards de resumo do mês: **Horas extras** (total somado), **Horas devidas** (atrasos + saídas antes, somados), **Faltas** (dias), **Banco de horas**.
     - Seletor de mês.
     - Tabela do mês inteiro, um dia por linha: data, dia da semana, todas as batidas em chips (entrada, almoço, volta, saída; a batida que faltou aparece como chip tracejado "faltou"), horas trabalhadas, extras, devidas e situação.
     - Hoje aparece como "Em andamento" e não conta nada até o fim do expediente (mesma regra de agora).
   - **Justificar só batida não registrada**: o botão "Justificar" aparece apenas em dias com batida faltando (marcação incompleta) ou sem nenhuma batida. Atrasos e saídas antes do horário não têm botão — só ficam visíveis como horas devidas. Caso da Rubia resolvido.
   - Tudo só leitura, sem botões de gestão.

2. **"Meu Dia" mais bonito, no estilo dos cards de baixo**
   - Os blocos (pagamentos de hoje, agendar amanhã, não saiu da conta, pendências, risco de caixa) viram cards com faixa colorida no topo, ícone, número grande e rótulo — o mesmo visual dos cards da Carteira de clientes.
   - Clicar no card abre a lista resumida por empresa (como já funciona).
   - Título "Meu Dia — tarefas das suas empresas" para diferenciar do ponto.

3. **Carteira de clientes sem "Sem Fluxo Bancário"**
   - O card/filtro "Sem Fluxo Bancário" sai para todos. Empresas nessa situação continuam aparecendo na lista e, quando faltar extrato, ficam em "Extrato não enviado".

## Antes de construir
Posso montar uma prévia da aba "Meu ponto" e do novo Meu Dia (imagem da visão da Rubia) para você aprovar o visual — aprovando o plano, faço primeiro essa prévia e mostro.

## Detalhes técnicos
- `ManagementCenter.tsx`: item de menu `my_time` ("Meu ponto") quando `useMyTeamTime` retorna funcionário vinculado e o usuário não é super admin; `responsible` oculto para não super admin; remover `MyTeamTimeCard` do topo; remover as duas entradas `no_bank` da lista de cards.
- `MyTeamTimeCard.tsx` → evolui para `MyTeamTimePage` com seletor de mês, cards e tabela completa, reaproveitando `classifyDay`/`minToHhmm` (sem regra duplicada).
- Regra de justificar: `canJustify = !emAndamento && (situacao in ['incompleta','sem_marcacao','falta'] || batidas < previstas)`; remove `atraso`/`faltaMin` da condição. Nada muda no banco nem nas permissões.
- `MyDayPanel.tsx`: troca o layout dos blocos para o mesmo padrão visual dos cards da carteira (tokens semânticos).
