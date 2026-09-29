# Bradesco (Manaus, Dourados, Fazenda) e Banco do Brasil de Dourados

## O que já confirmei
- **Manaus Laranjeiras – Bradesco:** o arquivo novo tem 101 linhas, e várias já estão gravadas com a mesma data, valor e descrição (ex.: Pix de R$ 333,00 do Julio em 21/09). Só o número de identificação mudou (antes N11276, agora N1015E). Mesmo assim, 99 foram marcadas como novas.
- **Fazenda Rio Grande – Bradesco:** mesmo sintoma. Já existem 95 lançamentos até 25/09, e o arquivo aparece com "106 novos". A diferença de R$ 18.643,39 é consequência dessa duplicação, **não é aplicação**.
- **Dourados – Bradesco:** mesmo caso dos 7 lançamentos de hoje cedo.
- **Conclusão:** a correção de hoje (reconhecer o lançamento quando o Bradesco muda o número) **não está funcionando na prática**. É um único problema nas três empresas.
- **Dourados – Banco do Brasil:** o PDF enviado é uma imagem, sem texto, então ainda preciso ler por OCR. O sistema mostra R$ 151.130,01 e o extrato mostra R$ 151.153,68, diferença de R$ 23,67. Hoje cedo a diferença era o rendimento do Rende Fácil, de R$ 21,21. Ainda não sei de onde vêm os R$ 153.322,53 do resumo.

**Até a correção:** não confirmem importação de Bradesco nessas três empresas.

## O que vou fazer
1. **Bradesco renumerando lançamentos:** reproduzir com os arquivos de Manaus, Fazenda e Dourados contra os dados reais, achar por que o reconhecimento falha e corrigir. Resultado esperado: Manaus e Dourados mostram só os lançamentos realmente novos, e Fazenda mostra só o que vier depois de 25/09. Continua valendo a regra de que dois lançamentos idênticos no mesmo dia contam como dois.
2. **Tirar o botão "Tratar como aplicação" da equipe:** a equipe passa a ver só o aviso da diferença, com a orientação de chamar a supervisão. O botão fica visível apenas para super_admin.
3. **Banco do Brasil de Dourados:** ler o PDF (por OCR), comparar linha a linha com o sistema e explicar os R$ 23,67 (rendimento ou lançamento faltando). Também vou identificar o que forma os R$ 153.322,53 do resumo, que parece incluir outra conta ou um lançamento futuro. Só corrijo depois de achar a causa exata.
4. Testar na tela com os arquivos reais e publicar.

## Detalhes técnicos
- `BankAccountsImports.tsx`: depurar o fallback `cand2` (bank_ref diferente + data/valor/tipo/descrição normalizada). Hipóteses: filtro da consulta, conjunto `existing`/`hashes` ou normalização. Criar teste Vitest com o OFX de Manaus e as linhas atuais do banco como fixture. Ao confirmar, atualizar só `bank_ref` das linhas casadas.
- Botão de aplicação: condicionar a `has_role(super_admin)` pelo hook de auth existente. Nenhuma mudança de schema.
- BB: OCR local só para diagnóstico; nenhuma gravação sem fechar com os saldos impressos.
