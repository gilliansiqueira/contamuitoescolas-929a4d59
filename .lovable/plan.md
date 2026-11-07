# Texto da análise que aprende com a equipe + lucratividade correta

## Resposta direta
Hoje, só salvar **não** ensina nada: o texto salvo fica guardado só naquele mês e o próximo rascunho começa do zero. A lucratividade também não usa a receita integral: o rascunho só repete os indicadores que já estão gravados, sem destacar os dois cenários.

## O que muda

### 1. Aprender com os textos salvos
- Ao clicar em **Gerar rascunho**, a plataforma manda para a IA, como exemplo de estilo, os últimos textos **editados e salvos pela equipe** (até 3: primeiro da própria empresa, depois de outras da rede), do mesmo tipo (Relatório ou Projeção).
- A IA copia só o **jeito de escrever** (tom, ordem, tamanho, emojis). Os números dos exemplos nunca são reaproveitados; o aviso de "número fora dos fatos" continua valendo.
- Novo campo opcional **"Orientações desta empresa"** (ex.: "Sinop: sempre falar da franqueadora"), salvo por empresa e usado em todo rascunho dela.
- Basta corrigir o texto e clicar em **Salvar**; na próxima vez ele já serve de exemplo.

### 2. Lucratividade nos fatos do texto
- **Empresas com receita integral salva (ex.: Sinop):** o texto traz a lucratividade sobre a receita integral como principal e diz que é a visão "sem o efeito das antecipações".
- **Empresas com duas lucratividades (operacional e total com empréstimos/operações):** o texto mostra os **dois cenários** lado a lado, explicando a diferença em uma frase.
- **Empresas com uma só lucratividade:** segue como hoje.
- Os valores vêm do mesmo cálculo do Dashboard (sem conta nova).

## Detalhes técnicos
- `monthly_report_analyses`: usa `edited_by`/`updated_at` existentes; consulta os últimos registros com `edited_by` não nulo por `kind` (escola atual primeiro) e envia como `examples` à Edge Function `draft-monthly-analysis`, com instrução "imite o estilo, ignore os números".
- Nova tabela `report_writing_guidelines (school_id, content, updated_by, updated_at)` com RLS só da equipe + RESTRICTIVE `can_see_school`.
- `buildReportFacts`: recebe `integralRevenue` (de `monthly_integral_revenue`) e os totais do `buildMonthMovement`; usa `src/lib/profitability.ts` para gerar linhas "Lucratividade sobre receita integral", "Lucratividade operacional" e "Lucratividade total (com operações)" quando aplicável, rotuladas para a IA citar os dois cenários.
- Teste em `reportNarrativeFacts.test.ts`: com receita integral salva aparece a linha integral; com duas lucratividades aparecem as duas.
