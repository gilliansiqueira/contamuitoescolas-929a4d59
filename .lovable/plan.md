# Travamentos do sistema (reclamação da Rayssa)

## O que já foi conferido
- O servidor está no ar, sem quedas e sem alertas de falta de recurso nas últimas 48 horas. Memória está em 77%, o que é alto, mas sem alerta.
- Achei um ponto de desperdício grande. Para saber o saldo dos bancos, a plataforma faz **uma consulta separada para cada extrato importado**, em cada empresa da carteira, repetidamente pelo "Meu dia". Foram mais de 1,5 milhão de consultas desse tipo, e é a maior carga do servidor hoje.
- Os lançamentos de cada empresa são carregados inteiros, de forma repetida. Cada leitura leva em média meio segundo e pode chegar a 7 segundos.
- Ainda **não confirmei** por que a tela congela ao trocar o período no Dashboard. Pode ser lentidão do servidor ou conta pesada feita no próprio navegador. Isso é o passo 1.

## O que vou fazer
1. **Reproduzir o problema:** abrir o Dashboard de uma empresa da carteira da Rayssa, trocar o período várias vezes e medir onde o tempo vai: espera do servidor ou travamento do navegador.
2. **Cortar o desperdício do saldo bancário:** trocar as centenas de consultas por uma só por empresa. O resultado continua o mesmo, só fica mais rápido.
3. **Evitar recarregar à toa:** os lançamentos não devem ser buscados de novo quando só o período muda, porque os dados são os mesmos e muda apenas o recorte.
4. **Corrigir o congelamento** conforme o passo 1 mostrar. Se for conta pesada no navegador, faço a conta uma vez e reaproveito ao trocar o período, sem mudar nenhum número.
5. **Medir de novo** depois das mudanças e comparar com o antes.

Nenhum cálculo financeiro muda: os números do Dashboard continuam saindo da mesma regra.

## Detalhes técnicos
- `fetchBankAccounts` (`src/hooks/useBankPilot.ts`) faz um `count` por import do mesmo dia (`import_id`+`data`). O Inter cria import a cada leitura e há 3.289 imports desde set/2026. A troca é uma única consulta `select import_id` com `in(import_id, ids)` e `eq data`, agrupada no cliente (ou RPC), com o mesmo resultado em `shifted`.
- `useMyDay` chama isso por escola. Avaliar o cache (`staleTime`).
- `useFinancialData` traz `financial_entries` completo por `school_id`. Conferir se `queryKey`/`staleTime` disparam refetch ao trocar o período.
- Reproduzir com Playwright e trace de performance. Para entrar como a Rayssa é preciso aprovação, ou uso um super admin numa empresa dela.
