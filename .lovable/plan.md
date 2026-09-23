# Aba "Dados" visível apenas para administradores

## O que muda

A tela de Dados (tabela bruta de lançamentos) continua exatamente igual à que existe hoje — mesma tabela, mesmos filtros, mesmas edições. A única mudança é onde ela aparece:

- Volta para a barra principal da Projeção, ao lado de Dashboard, Fluxo Diário, Recebíveis etc.
- Aparece somente para usuários Administradores. Clientes não veem a aba.
- Continua também acessível dentro de Configurações, como está hoje, sem duplicar comportamento.
- No modo demonstração e no modo apresentação ela permanece oculta, como as demais telas operacionais.

No celular, a aba aparece na faixa deslizável e no menu de navegação, também apenas para administradores.

## Detalhes técnicos

Em `src/pages/Index.tsx`:

- Transformar `mainTabs` em uma lista com flag `adminOnly`, adicionando `{ key: 'datatable', label: 'Dados', icon: Table2 ou Database, adminOnly: true }` ao final.
- Derivar `visibleMainTabs = mainTabs.filter(t => !t.adminOnly || (isAdmin && !isPresentationMode && !isDemo))` e usar essa lista na nav desktop, na faixa mobile e em `navSections` (seção "Projeção") e no cálculo de `currentTabLabel`.
- Manter `activeTab === 'datatable'` renderizando o mesmo `DataTable` dentro de `ExportPdfSection`, sem alteração de props.
- Se `activeTab` for `datatable` e o usuário não for administrador, voltar para `dashboard` (mesma proteção já usada para abas de configuração).
- Manter a entrada "Dados (tabela bruta)" em `settingsTabsBase` como está.

Nada de dados, cálculos, consultas ou banco é alterado.
