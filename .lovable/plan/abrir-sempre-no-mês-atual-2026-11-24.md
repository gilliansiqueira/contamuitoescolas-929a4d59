# Abrir sempre no mês atual

## O que acontece hoje
Na primeira vez que alguém abre uma empresa, a plataforma escolhe o **último mês que tem lançamentos**. Como existem previsões futuras (até setembro/2027), o Murilo caiu direto em set/2027 — só previsões, por isso pareceu errado. Depois disso, o mês escolhido fica guardado no navegador e volta sempre igual.

## O que muda
- Ao entrar na plataforma ou trocar de empresa, o período abre **sempre no mês atual** (hoje: novembro/2026), para todos — equipe e clientes.
- Enquanto a pessoa navega entre as telas, o mês que ela escolheu continua valendo; só volta ao mês atual quando entra de novo ou troca de empresa.
- O mês escolhido deixa de ficar guardado no navegador (alinha com a regra do projeto de não guardar dados no navegador).
- Vale também para o filtro de CNPJ (volta para "Todos" ao entrar).

## Detalhes técnicos
- `src/contexts/GlobalPeriodContext.tsx`: valor inicial = `currentMonth()`; remover leitura/gravação de `localStorage` (`global-period:*` e `global-entity:*`) e a regra "último mês com lançamentos"; resetar ao mudar `schoolId`.
- Conferir no navegador: entrar numa empresa com previsões futuras e ver que abre em nov/2026.
