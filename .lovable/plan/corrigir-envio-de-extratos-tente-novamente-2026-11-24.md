# Corrigir envio de extratos ("Tente novamente")

## Causa (confirmada no código)
Não é o arquivo do Asaas nem o Hauer. Na mudança de ontem (ignorar lançamentos anteriores ao início do acompanhamento, pedida para a Wizard), a etapa de **conferência** passou a responder com a contagem de lançamentos ignorados antes de essa contagem ser calculada. Isso gera um erro interno e a tela mostra "Não foi possível concluir a importação agora. Tente novamente."

Consequência: **nenhum extrato, de nenhuma empresa ou banco, está passando da conferência** desde a publicação dessa regra. O último envio do Hauer gravado foi em 23/11, antes da mudança; hoje nada chegou a ser gravado (nada foi perdido nem duplicado).

## Correção
1. **Regra só para as 3 Wizard:** o corte de lançamentos anteriores ao início do acompanhamento passa a valer apenas para Wizard Leme, Wizard IC e Wizard SF (ligado por empresa). Todas as outras empresas voltam a importar exatamente como antes.
2. Para as Wizard, calcular os lançamentos anteriores ao início do acompanhamento **antes** da conferência, e usar o mesmo cálculo na conferência e na gravação (o aviso "X lançamentos antigos serão ignorados" passa a aparecer já na conferência).
3. Adicionar um teste que roda a conferência de um extrato e garante que ela responde sem erro, para isso não voltar.
4. Reimplantar a função de importação (vale na hora, sem precisar publicar).
5. Conferir enviando de verdade um extrato de teste pela conferência e confirmar nos registros que não há mais erro. Depois a equipe pode reenviar o extrato do Asaas do Hauer normalmente.

## Detalhe técnico
`supabase/functions/bank-statement-import/index.ts`: a linha do `action === 'validate'` usa `ignored`, declarado depois com `const` (zona morta temporal → ReferenceError → catch genérico 500). Mover a leitura de `school_data_sources.start_month` e `filterRowsFromStart` para antes do retorno de validate; aplicar o corte só quando `school_features.extrato_corte_inicio` estiver ligado (ativar nas 3 Wizard); manter regras de identidade e gravação inalteradas.
