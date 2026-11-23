# São Carlos: liberar Pendências (entradas e saídas) para o cliente

## O que muda
- Ligar a tela **Pendências** para São Carlos com entradas e saídas, como já funciona em Dourados.
- O cliente já cadastrado (direcaosaocarlos@influx.com.br) passa a ver o sininho no topo e o item "Pendências" no menu.
- As respostas dele são só anotações: não classificam, não conciliam e não mudam nenhum cálculo.

## Conferência
- Confirmar que a lista retorna as pendências de São Carlos (quantidade e total por entradas/saídas).
- Não é preciso publicar: a liberação vale na hora no endereço oficial.

## Depois
- Enviar o passo a passo para o cliente: entrar, clicar no sininho ou em "Pendências", filtrar, escrever a resposta e enviar.

## Detalhes técnicos
- Inserir em `school_features` (school_id `77b0e7bb-48db-415b-aa5b-72f0acb36326`) as chaves `cliente_pendencias_saidas` e `cliente_pendencias_entradas` habilitadas. Sem código novo.
