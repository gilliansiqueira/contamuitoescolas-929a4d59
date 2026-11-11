# Ather: indicadores novos para a reunião de hoje + passo a passo do Conta Azul

## 1. Indicadores novos (pronto hoje)
Nova aba **"Análise por obra"** dentro de Centros de custo, no Relatório Realizado. Ela aparece só para empresas que têm centros de custo ligados, o que hoje inclui a Ather. Use o filtro de meses para escolher o período. Os mesmos quadros também entram no PDF do relatório.

- **Resultado por obra:** receita, despesa, resultado e margem de cada obra, do melhor para o pior. De set/out só aparecem as despesas, porque as receitas desses meses ainda não chegaram.
- **Top 10 obras por gasto** e **top 10 fornecedores**, com a participação de cada um.
- **Evolução das categorias mês a mês:** as 8 maiores categorias, mostrando a variação em relação ao mês anterior.
- **Obra x estrutura:** quanto vai para as obras e quanto fica em "ATHER ENGENHARIA" (administrativo), com a porcentagem de cada parte.
- **Obras em destaque:** obras cujo gasto no mês ficou mais de 30% acima da média dos meses anteriores.

**Fica fora por enquanto:**
- **Contas em atraso:** só lançamos contas já pagas, então ainda não há informação para esse quadro. Ele entra junto com o Conta Azul.

## 2. Conta Azul (depois)
A ligação segue o padrão da WNC, para a Ather e para as 3 Wizards da Gisley (IC, Leme e SF). Nada é feito agora; quando chegarem as chaves, faço um plano próprio.

### Passo a passo para a Gisley (e para a Ather)
1. Entrar em **developers.contaazul.com** com um login de administrador do Conta Azul e criar uma conta de desenvolvedor.
2. Abrir **"Minhas aplicações" > "Nova aplicação"**. No nome, usar "Conta Muito" e no tipo, escolher integração própria.
3. Em **URL de redirecionamento**, colar o endereço que eu vou passar no dia da integração.
4. Copiar o **Client ID** e o **Client Secret** e me mandar por um canal seguro.
5. No dia da integração, quem tem login de cada empresa (as 3 Wizards e a Ather) clica em "Conectar Conta Azul" na plataforma e autoriza. É um login por empresa.

**Dúvida:** quero confirmar se um único aplicativo serve para todas as empresas. A ideia é criar só um e conectar cada empresa nele.

## Detalhes técnicos
- **Base dos quadros:** `expense_detail_groups` e `expense_detail_items`, já filtrados pelo período, mais `realized_entries` para as categorias e os fornecedores. São só agregações de exibição, sem recalcular a SSOT.
- **Código novo:**
  - Regras puras em `src/lib/costCenterAnalytics.ts`, com teste.
  - Componente `AnaliseObras.tsx` na tela de Centros de custo.
  - Seção nova no `fechamentoPdf.ts`, ativada quando `isCostCenterReport`.
- **Obra x estrutura:** a estrutura é o grupo cujo nome contém "ATHER ENGENHARIA". Se outra empresa usar a mesma análise, a estrutura passa a ser configurável.
