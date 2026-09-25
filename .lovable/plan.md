# Sicoob: Piraquara (PDF) e Rio Verde (saldo em conta)

## Piraquara — PDF só traz os lançamentos futuros
**Causa confirmada:** a regra criada para o Banco do Brasil diz "se o PDF tiver um bloco *Lançamentos futuros*, importar só esse bloco". O extrato do Sicoob também tem esse bloco (os DÉB. CONV. de 05/10, 13/10 e 05/11), então o sistema descartou todos os lançamentos já efetivados.

**Correção:**
- A regra "só os futuros" passa a valer apenas para o PDF do Banco do Brasil (identificado pelo próprio arquivo), ou quando já existe OFX da conta cobrindo o período.
- No Sicoob (e demais bancos), o PDF importa os lançamentos efetivados normalmente; os futuros entram como **Previsto — aguardando extrato**, trocados pelo real depois (mesma regra do BB, sem duplicar).
- Ler o saldo final do PDF do Sicoob automaticamente, sem digitação.
- Corrigir também o sentido dos futuros (na tela, o DÉB. CONV. TELECOMUN. apareceu como entrada).
- Testar com o PDF de Piraquara antes de liberar.

## Rio Verde — em conta R$ 10.219,58 x banco R$ 5.964,46 (diferença R$ 4.255,12)
**O que já conferi:**
- Os lançamentos do OFX somados a partir do saldo inicial cadastrado (R$ 0,00 em 01/09) dão exatamente R$ 10.219,58. Ou seja, o sistema está somando certo o que tem.
- O próprio OFX informa saldo final em conta de R$ 5.964,46 (igual ao banco).
- Aplicações/resgates RDC automáticos foram reconhecidos corretamente.
- O "saldo com aplicação" gravado da importação (R$ 125.058,32) não bate nem com o aplicado (76.451,72) nem com conta + aplicado — está sendo lido do campo errado do OFX do Sicoob.

**Causa ainda não confirmada.** Hipóteses: saldo inicial em conta de 31/08 cadastrado errado (deveria ser cerca de −R$ 4.255,12 ou ter um lançamento de 01/09 fora do arquivo), ou lançamentos que o OFX não trouxe.

**Passos:**
1. Abrir o arquivo OFX original guardado e conferir dia a dia o saldo do banco contra o saldo calculado, para achar exatamente o dia e a(s) linha(s) onde nasce a diferença de R$ 4.255,12.
2. Corrigir a causa encontrada (saldo inicial ou linha faltante) mostrando antes para vocês — nenhum lançamento é alterado sem aprovação.
3. Corrigir a leitura do saldo aplicado do OFX do Sicoob para pegar o valor certo (R$ 76.451,72) ou deixá-lo em branco quando o arquivo não informar.

## Regras preservadas
- Nada antes de 01/09/2026 é alterado; histórico e Dashboard/Fluxo Diário intactos.
- Importações continuam rastreáveis e sem duplicidade.

## Detalhes técnicos
- `parsers.ts` / `parsePdfLines`: condicionar `inFuturos → só futuros` a detecção de BB; senão devolver `txs` + `futuros` (futuro:true). Ajustar sinal via marcador D/C do Sicoob. Novo leitor de "SALDO" do layout Sicoob.
- OFX: revisar leitura de `<BALLIST>`/`<AVAILBAL>` para Sicoob (hoje grava 125.058,32 em `saldo_aplicado_informado`).
- Teste novo em `src/test` com linhas do PDF Sicoob.
