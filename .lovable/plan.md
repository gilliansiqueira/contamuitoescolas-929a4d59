# Menos trabalho na conciliação: baixas automáticas e sugestões

Hoje há 47.314 lançamentos de extrato conciliados e 5.158 pendentes, todos marcados um a um pela equipe. A ideia é a plataforma fazer o trabalho repetitivo e deixar para a equipe só o que não bater. Nada vira "conciliado" sem regra clara, e tudo pode ser desfeito.

## 1. Sugestão automática de classificação (maior ganho)
- A plataforma aprende com o que a equipe já conciliou em cada empresa: mesmo favorecido ou descrição parecida, mesmo sentido e valor parecido → sugere o mesmo item do modelo.
- Na tabela do extrato aparece a sugestão com o grau de confiança e o motivo ("conciliado assim 12 vezes desde agosto").
- Botão **"Aceitar sugestões confiáveis"** concilia de uma vez as que tiverem histórico forte (ex.: 3 ou mais vezes, sem nenhuma divergência). As demais ficam para revisar com um clique.

## 2. Baixa automática do cartão
- Ao subir o extrato da maquininha (Stone, PagBank, Cielo, Rede, Getnet, Omni), a plataforma cruza cada repasse com o depósito no banco (mesmo dia ou até 2 dias úteis, mesmo valor líquido ou soma do dia) e já concilia o depósito como recebimento de cartão.
- A previsão de cartão do Sponte daquele período é substituída pelo valor real (regra que já existe), e a tela mostra o que sobrou sem par: repasse sem depósito ou depósito sem repasse.

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
- Cartão: `src/lib/cardSettlementMatch.ts` (repasse ↔ depósito, tolerância e lote por dia), reaproveitando os parsers de maquininha e `sponteCardGuard`.
- Auditoria: nova coluna `recon_source` (manual | sugestao | automatico) em `bank_transactions` (migração aditiva), mais registro em `bank_reconciliation_history`; desfazer em lote por importação.
- Baixa no sistema da escola: colunas `school_system_status` (pendente | baixado | nao_se_aplica), `school_system_confirmed_at/by/source` em `bank_transactions` (aditivas); cruzamento puro `src/lib/schoolSystemMatch.ts` com os relatórios Omni/Sponte já lidos pelos parsers existentes; liberado por empresa em `school_features`.
- Antes de gravar, primeiro rodar em modo simulação numa empresa (ex.: Rondonópolis) e comparar com o que a equipe já conciliou, para medir acerto antes de liberar o "Aceitar".
