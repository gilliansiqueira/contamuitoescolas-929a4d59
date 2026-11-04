# Menos trabalho na conciliação: baixas automáticas e sugestões

Hoje há 47.314 lançamentos de extrato conciliados e 5.158 pendentes, todos marcados um a um pela equipe. A ideia é a plataforma fazer o trabalho repetitivo e deixar para a equipe só o que não bater. Nada vira "conciliado" sem regra clara, e tudo pode ser desfeito.

## Teste inicial: só Praia da Costa
Tudo fica ligado apenas para a Praia da Costa, por meio de uma chave por empresa. As outras empresas continuam exatamente como hoje até você aprovar.
A Praia da Costa ainda não tem nenhum extrato na plataforma. Então:
- as sugestões começam com base no que outras escolas da rede já conciliaram (mesmos fornecedores, tarifas e maquininhas), marcadas como "sugestão da rede", e passam a aprender com a própria empresa conforme a equipe concilia;
- o cartão, as contas a pagar e a baixa no Omni/Sponte já funcionam desde o primeiro extrato.

## 1. Sugestão automática de classificação (maior ganho)
- A plataforma aprende com o que a equipe já conciliou em cada empresa: mesmo favorecido ou descrição parecida, mesmo sentido e valor parecido → sugere o mesmo item do modelo.
- Na tabela do extrato aparece a sugestão com o grau de confiança e o motivo ("conciliado assim 12 vezes desde agosto").
- Botão **"Aceitar sugestões confiáveis"** concilia de uma vez as que tiverem histórico forte (ex.: 3 ou mais vezes, sem nenhuma divergência). As demais ficam para revisar com um clique.

## 2. Cruzamento triplo dos recebimentos: previsão, maquininha e banco
Para cada recebimento, a plataforma liga as três pontas:

```text
Sponte/Omni (previsão: aluno, parcela, valor)
        -> Repasse da maquininha (Stone, Getnet, Rede, PagBank, Sicredi: bruto, taxa, líquido, data)
        -> Entrada no banco (extrato)
```

- **Previsão ↔ repasse**: por aluno ou autorização (quando o relatório tiver), data e valor bruto, com tolerância para a taxa. Parcelado no cartão: cada parcela do repasse liga à mesma venda.
- **Repasse ↔ banco**: o líquido do dia (ou a soma dos repasses do dia) com o depósito, até 2 dias úteis.
- **Boleto/PIX** (sem maquininha): previsão ligada direto à entrada no banco.
- Uma tela por mês com quatro colunas de status: **Fechou nas três pontas**, **Falta repasse** (previsto e não vendido/pago), **Repasse sem depósito** e **Depósito sem previsão**. Cada linha mostra exatamente o que falta e a diferença em reais (taxa, valor divergente ou duplicidade).
- Quando fecha nas três pontas, a entrada do banco é conciliada automaticamente como recebimento, e a previsão do cartão do Sponte daquele período é substituída pelo valor real, sem nunca coexistir com a maquininha (regra que já existe).

## 3. Baixa automática das contas a pagar
- A conferência nova do Meu Dia (antecipado, juros, lote, item conciliado) passa a dar baixa na conta prevista quando acha a saída, e já sugere o item do modelo dessa saída no extrato. O que não bater continua no aviso "Não saiu da conta".

## 4. Confirmação da baixa no Omni/Sponte
A plataforma não consegue dar baixa diretamente no Omni nem no Sponte, porque eles não oferecem essa ligação. Por isso, a conciliação passa a ter **duas etapas visíveis**:
- **Conciliado no extrato**: a entrada do banco foi identificada.
- **Baixado no sistema da escola**: confirmado no Omni/Sponte.

Como confirmar a segunda etapa:
- **Automático**: ao subir o relatório de recebimentos/baixas do Omni ou do Sponte do período, a plataforma cruza aluno, data e valor com as entradas conciliadas e marca como "Baixado" o que encontrar.
- **Manual**: a equipe marca "Baixei no sistema" (em lote ou um por um), com registro de quem marcou e quando.

O que estiver conciliado e ainda não baixado aparece numa lista **"Falta baixar no Omni/Sponte"** por empresa, no Meu Dia de cada pessoa e no controle diário. Assim, a conciliação só conta como completa quando as duas etapas estiverem feitas.

## 5. Painel de ganho
- Mostrar por empresa e por pessoa quantos lançamentos foram conciliados automaticamente ou por sugestão e quantos de forma manual, para medir quanto trabalho saiu da equipe.

## Sobre o WhatsApp (fica para depois)
Como as conversas são em grupos, a ligação oficial do WhatsApp não consegue ler essas mensagens. O caminho possível é a equipe **exportar a conversa do grupo** (opção "Exportar conversa" do WhatsApp) e subir o arquivo. A plataforma então aponta mensagens sem resposta, demora na resposta e erros de português, e sugere solicitações para a equipe aprovar. Isso fica para uma etapa seguinte, quando terminarmos a conciliação.

## Detalhes técnicos
- Motor puro `src/lib/reconSuggest.ts` (chave: contraparte normalizada via `counterparty.ts` + sentido + faixa de valor; confiança por frequência/consistência), com testes. A classificação continua passando por itens do modelo/SSOT, nunca pelo sinal do valor.
- Cruzamento triplo: `src/lib/receiptThreeWayMatch.ts` (previsão ↔ repasse por aluno/autorização/data/bruto; repasse ↔ depósito por líquido e lote diário; boleto/PIX direto), com testes. Reaproveita os parsers Sponte/Omni e de maquininha e o `sponteCardGuard`. Novos leitores de repasse para Getnet, Rede e Sicredi, se ainda não existirem (pedir um arquivo de exemplo de cada um).
- Ligações gravadas em uma nova tabela `receipt_matches` (previsão, repasse e transação bancária, status, diferença), com RLS da equipe e RESTRICTIVE `can_see_school`.
- Auditoria: nova coluna `recon_source` (manual | sugestao | automatico) em `bank_transactions` (migração aditiva), mais registro em `bank_reconciliation_history`; desfazer em lote por importação.
- Baixa no sistema da escola: colunas `school_system_status` (pendente | baixado | nao_se_aplica), `school_system_confirmed_at/by/source` em `bank_transactions` (aditivas); cruzamento puro `src/lib/schoolSystemMatch.ts` com os relatórios Omni/Sponte já lidos pelos parsers existentes; liberado por empresa em `school_features`.
- Liberação por `school_features.conciliacao_assistida`, ativada só para Praia da Costa (`7a5b74f3-6340-4c0b-bc24-cd64341b4551`).
- Para medir o acerto antes de liberar o "Aceitar", rodar a sugestão em modo simulação (sem gravar) sobre o histórico de uma empresa já conciliada e comparar com o que a equipe fez.
