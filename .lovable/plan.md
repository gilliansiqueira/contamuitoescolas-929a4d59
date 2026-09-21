# Navegação mobile mais simples e completa

## O problema hoje

No celular:

- Em **Projeção**, a barra inferior mostra só 4 itens (Dashboard, Fluxo Diário, Recebíveis, Calendário). Comparativo, Cenários e Simulação ficam escondidos dentro de "Mais" — o cliente não descobre que existem.
- Em **Relatório Realizado** não existe barra de navegação nenhuma. As abas (Análise de Despesas, Indicadores, Conversão, Vendas, Análise de Vendas, Recebimento por Categoria, Teto de Gastos, Detalhamento) aparecem como botões que quebram em várias linhas e ocupam meia tela antes do conteúdo.

## O que vamos fazer

### 1. Faixa de subabas deslizável (os dois módulos)

Logo abaixo do seletor Projeção / Realizado, no celular, aparece uma faixa horizontal com **todas** as subabas em forma de "pílulas" com ícone e nome, que desliza com o dedo. A aba ativa fica destacada e a faixa rola sozinha para mantê-la visível. Um leve degradê na borda direita indica que há mais itens ao lado.

Isso vale tanto para Projeção quanto para Realizado — mesma aparência, mesmo comportamento, para o cliente aprender uma vez só.

### 2. Barra inferior com acesso a tudo

A barra inferior no celular passa a ter 4 itens fixos + "Menu":

- Projeção, Realizado (troca de módulo)
- Dashboard / início do módulo atual
- Período (abre o seletor de mês)
- Menu

O botão **Menu** abre uma folha deslizante de baixo para cima (bottom sheet) com todas as seções em grade de ícones, separadas por "Projeção", "Relatório Realizado" e "Configurações" (esta última só para a equipe). Nada mais fica escondido atrás de um menu de três pontinhos pequeno.

### 3. Ajustes de conforto

- Alvos de toque maiores (mínimo 44px) nas pílulas e itens do menu.
- O título da seção atual aparece no topo do conteúdo, para o cliente sempre saber onde está.
- Espaço inferior do conteúdo ajustado para a barra não cobrir o final da página.
- No desktop nada muda.

## Detalhes técnicos

- Novo componente `src/components/mobile/MobileTabStrip.tsx`: faixa de pílulas com `overflow-x-auto`, `scroll-snap`, `scrollIntoView` do item ativo, máscara de degradê. Recebe `items: {key, label, icon}[]`, `active`, `onChange`.
- Novo componente `src/components/mobile/MobileNavSheet.tsx`: usa `Sheet` (side="bottom") do shadcn, grade de ícones agrupada por seção.
- `src/pages/Index.tsx`:
  - Extrair a barra inferior para fora do ramo `appModule === 'projecao'` para valer nos dois módulos; adicionar botões de módulo e "Menu".
  - Renderizar `MobileTabStrip` (`sm:hidden`) com `mainTabs` quando em Projeção.
  - Estado do módulo/aba continua onde está; o sheet apenas chama `setAppModule` / `setActiveTab`.
- `src/components/realizado/RealizadoModule.tsx`: montar a lista de views visíveis (`relatorio`, `indicadores`, `conversao`, `vendas`, `analise_vendas`, `recebimento_categoria`, `teto_gastos`, `detalhamento`) como array de `{key, label, icon}` reaproveitado tanto pelos botões atuais (desktop, `hidden sm:flex`) quanto pelo `MobileTabStrip` (`sm:hidden`). Regras de visibilidade (`module_tabs`, `detalhamentoEnabled`, admin) permanecem idênticas.
- Para o Realizado aparecer no menu inferior, `RealizadoModule` expõe a view ativa via props controladas a partir de `Index.tsx` (estado sobe para o `IndexBody`), sem alterar nenhuma lógica de dados.
- Somente apresentação: nenhuma regra financeira, consulta ou cálculo é alterado.
