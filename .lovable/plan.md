# Aumentar o servidor (com custo visível) e publicar a área "Ponto da Equipe"

## O que já confirmei sobre custo e pagamento

**Cartão:** sim, este espaço de trabalho **já tem um cartão de crédito cadastrado** e um endereço de cobrança válido, e está pronto para pagamento direto. Nenhum cadastro extra é necessário para seguir. Você pode ver qual cartão é em Configurações do espaço de trabalho → Faturamento (em alguns casos aparece como "Planos e créditos").

**Como a cobrança funciona:** o servidor do sistema (Lovable Cloud) é cobrado em **créditos**, descontados do saldo do espaço de trabalho — não é uma cobrança avulsa no cartão a cada mês. O cartão é usado quando você **compra créditos**. Todo plano (incluindo o seu, Pro) tem **20 créditos grátis por mês** para o servidor; o que passar disso sai do saldo.

**O que o servidor atual custa de verdade** (medido no seu próprio uso, de 1 a 25 de setembro):

```text
Servidor (tamanho atual, o menor):  10,73 créditos
Tráfego de dados:                    1,05 créditos
Outros (armazenamento/funções):      0,32 créditos
Total de servidor no período:       12,10 créditos  →  ≈ 15 créditos/mês
```

Ou seja: hoje o servidor **cabe dentro dos 20 créditos grátis**. Um servidor maior passa a custar mais que isso, e a diferença sai do saldo.

**Saldo agora:** 46 créditos restantes (572,96 já usados neste ciclo, que vai até 1º de outubro). Se o tamanho escolhido passar dos 20 grátis, provavelmente será preciso comprar mais créditos — dá para fazer isso no mesmo lugar, com o cartão já salvo.

**O valor exato de cada tamanho** aparece no seletor, como "custo mensal estimado", **antes** de você aprovar. Se você cancelar o seletor, nada é cobrado e nada muda.

## Passos

1. **Abrir o seletor de tamanho do servidor.** Você vê CPU, memória e o custo mensal estimado de cada opção, escolhe uma e aprova — ou cancela, sem custo.
2. **Aguardar a troca** (alguns minutos, com o sistema fora do ar por 1 a 2 minutos) e conferir se memória, conexões e disco voltaram confortáveis.
3. **Republicar o site oficial**, para a área "Ponto da Equipe" sair da prévia e aparecer para você no site.
4. **Conferir no ar** que a área nova está disponível e que nada mais mudou.
5. **Entregar a lista final** do que pedir à Employer/ePays para ligar a integração do ponto.

## Sobre mover o projeto para "Bruna's Lovable"

Minha recomendação é **deixar para depois** e resolver a lentidão primeiro:

- O cartão da sua conta já está aqui, então não há ganho imediato em mudar.
- A transferência leva o código e as configurações, mas há risco para os dados do servidor — e o seu histórico financeiro (até 01/09/2026) é justamente o que não pode se perder.
- Quando fizer a迁移, o cartão precisará ser cadastrado lá, e é o suporte quem faz a transferência com segurança.

Podemos tratar disso como um assunto separado, com backup antes.

## Detalhes técnicos

- Tamanho atual: a menor instância (a própria equipe de suporte apontou a sobrecarga contínua de CPU nela).
- Sem tarefas agendadas no projeto (o agendador de banco nem está instalado), então não há nada para desativar.
- A troca de tamanho é reversível: dá para reduzir de novo se a carga cair.
- Nenhuma migration nova, nenhuma tabela, tela, relatório ou número financeiro é alterado. A sincronização automática do ponto continua desligada.
- A publicação anterior foi interrompida no meio (uma mensagem chegou durante a aprovação) e será refeita.
