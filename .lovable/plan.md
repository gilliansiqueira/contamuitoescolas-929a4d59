# Extrato Bradesco: Agência One bloqueado e SJP duplicando

## O que encontrei

**Agência One — bloqueio "conta de outra empresa"**
- No cadastro, a conta Bradesco da Agência One está como agência 5746, conta 548548.
- O arquivo enviado (Bradesco_11112026_085639_1.OFX) mostra a conta **29810**. São números diferentes, por isso a proteção bloqueou.
- Antes da proteção, os OFX dessa conta entravam normalmente (o último foi em 10/11). Então ou o cadastro está desatualizado, ou a Agência One tem mais de uma conta Bradesco.

**SJP — "conta de outra empresa"**
- No cadastro: agência 6638, conta 00500771. O arquivo mostra 50077, ou seja, a mesma conta sem o dígito. Pela regra nova isso só gera aviso, não bloqueio. O OFX de hoje, às 08:40, chegou a entrar (com aviso). Provavelmente o bloqueio apareceu numa tela que ainda usa a regra antiga (a versão nova da tela ainda não foi publicada).

**SJP — duplicidade (problema real)**
- O OFX de hoje gravou 24 lançamentos. **7 deles (R$ 8.300,00) já existiam** de importações anteriores. Exemplo: PIX ELISANGELA QUANDT de R$ 100,00 em 04/11 está duas vezes.
- Causa: a nova forma de gravar não reconhece os lançamentos gravados antes da proteção (a "impressão digital" do lançamento é calculada de outro jeito). A regra de sempre (mesmo dia, sentido, valor e texto equivalente) deixou de ser aplicada nessa etapa.

## O que proponho fazer

1. **Corrigir a duplicidade na gravação:** antes de gravar, comparar também com os lançamentos já existentes da conta pela regra de sempre (dia + sentido + valor + texto equivalente), respeitando quantidades repetidas no mesmo dia. Vale para todos os bancos e formatos.
2. **Contas sem dígito:** garantir em todas as telas que "50077" contra "0050077-1" seja tratado como a mesma conta (só aviso).
3. **Limpar os 7 duplicados de hoje em SJP:** mostro a lista antes e só removo depois do seu ok, mantendo a versão antiga, que já está conciliada.
4. **Agência One:** depende da sua resposta (abaixo). Se o cadastro estiver errado, corrijo a conta para 29810. Se forem duas contas, cadastro a segunda.
5. Testes com arquivos fictícios reproduzindo os dois casos e conferência com os arquivos que você enviou.

## Preciso que você confirme
- A conta Bradesco correta da Agência One é a **29810**? A 548548 é antiga ou é outra conta?
- Depois disso, publique a versão nova da tela para o aviso parar de aparecer como bloqueio.

## Detalhes técnicos
- A função `commit_verified_bank_import` passa a deduplicar contra linhas antigas com `bank_ref` nulo usando a mesma regra de `sameBankEntryText` (descrição normalizada e espaços colapsados), contando as ocorrências por dia/valor/sentido. Migration nova, sem alterar linhas existentes.
- `compareNumber`/`bank_identity_cmp_num`: confirmar que o caso de dígito verificador ausente retorna "incerto" nos dois lados.
- Remoção dos duplicados (import `4ee521c8…`) feita só após aprovação, preservando as linhas originais conciliadas.
