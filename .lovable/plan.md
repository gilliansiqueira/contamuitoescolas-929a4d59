# Parar a duplicação quando o banco muda a descrição do mesmo lançamento

## Causa confirmada
Em Portão, o rendimento de R$ 2,10 de 06/10 (Itaú) tem o mesmo código do banco nos dois arquivos (20261006003), mas a descrição mudou:
- arquivo de 07/10: "REND PAGO APLIC AUT APR" (conciliado)
- arquivo de 08/10: "RENDIMENTOS REND PAGO APLIC AUT MAIS" (entrou de novo, pendente)

Ontem, por causa do Bradesco de Manaus, o sistema passou a exigir a descrição igual para reconhecer um lançamento que já existe. Lá o banco reaproveitava o mesmo código para outra pessoa. Por isso, quando o Itaú ou o BB mudam só o texto, a linha entra de novo.

Duplicações iguais a essa desde 07/10:
- **Portão**: rendimento R$ 2,10 (06/10)
- **Ather Engenharia**: rendimento R$ 0,04
- **Campo Largo**: rendimento R$ 0,01
- **Floripa Santa Mônica**: rendimento R$ 1,27
- **Floripa Ingleses**: boleto CDL R$ 318,25
- **Palmital**: BB Rende Fácil R$ 443,27 e R$ 3.993,93
- **Rondonópolis**: BB Rende Fácil R$ 10.988,11
- **Uberlândia Centro**: BB Rende Fácil R$ 3.405,90 e R$ 2.066,53
- **Uberlândia Santa Mônica**: BB Rende Fácil R$ 1.955,16 e R$ 2.140,78

Os 4 casos de Manaus Laranjeiras na mesma busca são Pix de pessoas diferentes. Eles estão certos e continuam como estão.

## O que muda
1. **Na importação**: com o mesmo código do banco, a mesma data, o mesmo valor e o mesmo sentido, o sistema compara as palavras que identificam o lançamento, sem contar termos genéricos como PIX, RECEBIDO, REM, PAGO, números e datas.
   - Se as palavras importantes se repetem (ex.: "REND… APLIC AUT", "BB RENDE FÁCIL", "CDL LOJISTAS"), é o mesmo lançamento e não entra de novo.
   - Se os nomes são diferentes (ex.: TAIANE × RAIMUNDO), continua sendo outro lançamento, como no caso do Bradesco.
2. **Limpeza**: remover as 12 cópias acima e manter sempre a primeira versão, que já está conciliada. O motivo fica registrado no histórico ("duplicado – banco mudou a descrição"). Nas duas Uberlândias e em Floripa Ingleses as duas cópias foram conciliadas, então tiro a mais nova e aviso você.
3. **Conferência**: depois da limpeza, o saldo de Portão no Itaú volta para R$ 72.238,64 em 06/10. Reenviar o arquivo de 08/10 não cria nenhuma linha nova.

## Detalhes técnicos
- `parsers.ts`: `sameRefTx` passa a usar `sameCounterpartyTokens(a, b)`. A função tira acentos, números e datas e uma lista de termos genéricos (pix, recebido, enviado, rem, pago, pagamento, ted, doc, boleto, rendimentos…). É igual quando um conjunto contém o outro ou quando se repetem pelo menos 2 palavras. `refCollisionHash` e `matchRenumberedRefs` seguem a mesma regra.
- Testes: Itaú (APR × MAIS) = duplicado; BB "BB RENDE FÁCIL" × "BB RENDE FÁCIL - RENDE FACIL" = duplicado; Bradesco TAIANE × RAIMUNDO = diferente; arquivo real enviado sem linhas novas.
- Remoção pela RPC `delete_bank_tx` (com motivo), sempre da linha `bank_ref IS NULL` criada depois de 07/10. Nenhuma regra de Receita, Despesa ou Resultado muda.
