# Aviso de entrada mais enxuto para o perfil administrador

## O que muda
Hoje, ao entrar, você vê a lista completa de empresas atrasadas por pessoa (e-mails e todos os nomes), o que fica longo e difícil de analisar.

Novo formato só para administradoras (as meninas continuam vendo a lista da própria carteira, que é curta):

- Título: "X projeções em atraso · faltam N dias para o relatório e texto (06/11)".
- Uma tabela compacta, uma linha por responsável: **nome curto** (ex.: "Thau", "Isabelly", sem e-mail) e **quantidade em atraso**, ordenada da maior para a menor. "Sem responsável" fica por último.
- Clicar na linha abre/fecha os nomes das empresas daquela pessoa (fechado por padrão).
- Botão "Ver na Central" (filtra os atrasados) e "Entendi".
- Janela com altura limitada e rolagem interna, sem ocupar a tela toda.

A faixa vermelha do topo continua igual.

## Detalhes técnicos
- Editar só `src/components/TeamDeadlineNotice.tsx`: quando o usuário for super_admin/gestora, renderizar o resumo agrupado com `Collapsible`; nome exibido = `profiles.full_name` (primeiro nome) com fallback para parte antes do "@".
- Nenhuma alteração na regra de cálculo dos atrasos nem no banco.
