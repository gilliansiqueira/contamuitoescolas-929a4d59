# Atualização automática do app dos clientes

## Resposta ao usuário
O ícone que os clientes instalaram no celular/computador não é um aplicativo da loja — é um atalho que abre o site da Conta Muito. Toda vez que publicamos o projeto (botão Publicar/Atualizar), a versão nova aparece automaticamente nesse atalho. O cliente nunca precisa "atualizar o app".

O único risco é o cache do navegador: às vezes ele guarda a versão antiga por um tempo (foi o que aconteceu com o ícone). Para cobrir isso:

## O que será implementado (opcional, camada de garantia)

1. **Aviso discreto de nova versão**
   - Arquivo `public/version.json` gerado com número/valor único a cada publicação.
   - No app, checagem leve em segundo plano (a cada 30 minutos e ao voltar para a aba aberta) compara a versão do site aberto com a versão mais recente do servidor.
   - Se houver versão nova, aparece uma faixa discreta: "Nova versão disponível" com botão "Atualizar" — ao clicar, recarrega a página já na versão nova.
   - Sem interrupção do trabalho: nada é recarregado sozinho; o usuário decide quando.

2. **Cache amigável**
   - O `version.json` é sempre buscado direto do servidor (sem cache), e a página HTML pede revalidação ao servidor — as melhorias publicadas chegam no dia seguinte ou assim que o cliente reabrir o app.

## O que NÃO é alterado
- Nenhum dado, cálculo, gráfico ou página do relatório.
- Nenhum motor financeiro (projectionEngine, ledgerEngine, classificationUtils, tipoMeta).
- Nenhum banco de dados ou consulta.

## Validação
- Simular publicação: alterar `version.json` e confirmar que a faixa "Nova versão disponível" aparece e o botão "Atualizar" recarrega na versão nova.
- Testar em computador e celular, com a aba em segundo plano e reaberta.
- Confirmar que a checagem não gera erros no console nem afeta o carregamento da plataforma.
