# Reorganização visual da área do cliente — Etapa 1 (moldura)

## Objetivo
Trocar apenas a "moldura" da plataforma: menu lateral laranja recolhível, cabeçalho limpo e agrupamento das abas. Nada muda em relatórios, cards, gráficos, valores, cálculos, importações, banco de dados ou permissões.

Direção visual aprovada: **"Modern orange frame"** — menu lateral em degradê laranja, item selecionado com fundo creme e texto laranja escuro, grupos com títulos em maiúsculas, Configurações fixadas no rodapé do menu.

## 1. Mapeamento do menu atual → novo menu

Hoje existem: faixa escura "Projeção / Relatório Realizado", abas horizontais da Projeção e menu "Config" (dropdown). Tudo vira um único menu lateral:

```text
MENU ATUAL                          NOVO MENU LATERAL
─────────────────────────────────────────────────────────
Projeção › Dashboard             →  Visão Geral › Dashboard
Projeção › Fluxo Diário          →  Caixa e Projeção › Fluxo Diário
Projeção › Recebíveis            →  Caixa e Projeção › Recebíveis
Projeção › Calendário            →  Caixa e Projeção › Calendário
Projeção › Comparativo           →  Caixa e Projeção › Comparativo
Projeção › Cenários              →  Caixa e Projeção › Cenários
Projeção › Simulação             →  Caixa e Projeção › Simulação
Realizado › Relatório            →  Resultados › Resultado Realizado
Realizado › Análise de Despesas  →  Resultados › Análise de Despesas
Realizado › Indicadores          →  Resultados › Indicadores
Realizado › Receb. por Categoria →  Resultados › Recebimentos por Categoria
Realizado › Teto de Gastos       →  Resultados › Teto de Gastos
Realizado › Conversão            →  Comercial › Conversão
Realizado › Vendas               →  Comercial › Vendas
Realizado › Análise de Vendas    →  Comercial › Análise de Vendas
Config › Exportar/Importar       →  Relatórios › Exportar / Importar
Config › Projetado vs Real       →  Relatórios › Projetado vs Real
Projeção › Dados (admin)         →  Operação › Dados
Projeção › Fluxo Bancário (adm)  →  Operação › Fluxo Bancário
Config › Upload de Dados         →  Operação › Upload de Dados
Config › Histórico de Uploads    →  Operação › Histórico de Uploads
Config › Histórico de Alterações →  Operação › Histórico de Alterações
Config › Usuários                →  Configurações › Usuários
Config › Saldo Inicial           →  Configurações › Saldo Inicial
Config › Modelo da Empresa       →  Configurações › Modelo da Empresa
Config › Modelos Financeiros     →  Configurações › Modelos Financeiros
Config › Histórico Financeiro    →  Configurações › Histórico Financeiro
Config › Prazos de Cobrança      →  Configurações › Prazos de Cobrança
Config › Guia & Regras           →  Configurações › Guia & Regras
```

Nenhuma página é removida. As abas do Relatório Realizado respeitam a ativação por empresa (`module_tabs`) exatamente como hoje.

## 2. Páginas e componentes afetados
- `src/pages/Index.tsx` — troca header + faixa de módulos + abas horizontais pelo novo shell (sidebar + cabeçalho).
- Novo: `src/components/app-shell/AppSidebar.tsx` (menu lateral) e `AppHeader.tsx` (cabeçalho).
- `src/index.css` — novos tokens de cor do menu (claro/noturno).
- Mobile: `MobileTabStrip`/`MobileNavSheet` continuam como estão nesta etapa (o menu lateral vira gaveta no celular, reutilizando a folha inferior).
- **Não serão tocados:** Dashboard, DailyFlowTable, Receivables, RealizadoModule e todas as telas de conteúdo, engines (projectionEngine, ledgerEngine, classificationUtils, tipoMeta), banco de dados e migrations.

## 3. Confirmação: conteúdo intacto
Os componentes de conteúdo serão renderizados dentro do novo shell sem nenhuma alteração de props, dados ou cálculos. Valores, gráficos, relatórios, PDFs e importações permanecem idênticos.

## 4 e 5. Proposta visual (aprovada na prévia)
- **Modo claro:** menu com degradê laranja `#F47A1F → #E66910`, textos e ícones brancos, títulos de grupo em branco 60%, item selecionado com fundo creme `#FEF3C7` e texto `#B45309`, hover em branco 10%, Configurações no rodapé com divisória discreta.
- **Modo noturno:** menu em laranja queimado `#9A3412`, conteúdo principal grafite (tokens atuais do tema escuro), item selecionado em branco 20%, ícones em branco 60%.

## 6. Cores exatas
```text
Claro:  menu #F47A1F→#E66910 | texto #FFFFFF | grupo rgba(255,255,255,.6)
        selecionado bg #FEF3C7 / texto #B45309 | hover rgba(255,255,255,.1)
Noturno: menu #9A3412 | texto rgba(255,255,255,.9) | grupo rgba(255,255,255,.4)
        selecionado rgba(255,255,255,.2) | hover rgba(255,255,255,.1)
```
Verde/vermelho/amarelo do conteúdo financeiro não mudam.

## 7. Comportamento do menu
- **Aberto (padrão):** 256px, ícone + nome, grupos expansíveis (grupo da página ativa começa aberto).
- **Recolhido:** 80px, só ícones, com nome no tooltip; botão de recolher no cabeçalho; escolha lembrada (preferência local de interface, sem dados financeiros).
- **Mobile (<768px):** menu lateral vira gaveta/folha; barra inferior Projeção/Realizado é substituída pela navegação da gaveta.
- Página selecionada sempre destacada; ao atualizar, abre no Dashboard (como hoje).

## 8. Permissões preservadas
Mesmas regras atuais, sem alteração: `Dados` e `Fluxo Bancário` só para admins (e Fluxo Bancário só nas empresas-piloto); Configurações só para admin fora do modo apresentação; demo e apresentação continuam redirecionando para o Dashboard; abas do Realizado respeitam `module_tabs`.

## 9. Rotas
A navegação interna por abas continua a mesma (estado `activeTab`/`realizadoView`), apenas renderizada pelo menu lateral. Nenhuma rota quebra; `/`, `/auth`, `/demo` intactas.

## 10. Implementação e reversão
1. Criar tokens do menu em `index.css` (claro/noturno).
2. Criar `AppSidebar` e `AppHeader` com o mapeamento acima.
3. Trocar o shell em `Index.tsx`, mantendo todo o conteúdo e redirecionamentos atuais.
4. Validar em desktop e mobile, claro e noturno, com admin e cliente.
5. **Reversão:** a mudança fica isolada no shell; basta restaurar `Index.tsx` e remover os dois componentes novos para voltar ao layout atual. Sem migrations, sem mudança de dados.
