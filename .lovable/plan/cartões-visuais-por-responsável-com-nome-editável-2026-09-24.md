# Cartões visuais por responsável com nome editável

## Objetivo
Transformar **Por Responsável** em uma grade mais visual, seguindo a direção **Interactive owner cards**, e permitir que a proprietária altere somente o nome exibido de cada responsável.

## Experiência aprovada
- Usar uma grade responsiva de cartões, com 3 colunas em telas largas, 2 em telas médias e 1 no celular.
- Manter a identidade escolhida: laranja equilibrado, creme, grafite e verde; títulos em Outfit e textos em Figtree.
- Destacar o nome amigável e manter o e-mail logo abaixo, menor, como identificação segura.
- Mostrar a quantidade de empresas e dois anéis independentes:
  - **Conciliação**;
  - **Fechamento**.
- Quando uma métrica não possuir dados, o anel mostrará **Indisponível**, sem representar 0%.
- Exibir na parte inferior os números já existentes: finalizadas, atrasadas, aguardando cliente e pendências.
- Ao clicar para expandir, abrir dentro do próprio cartão a lista compacta de empresas, situação e ação **Acessar**.

## Edição do nome
- Adicionar um lápis discreto ao lado do nome, visível e acessível também por teclado.
- Ao clicar, abrir edição no próprio cartão, com ações **Salvar** e **Cancelar**.
- Validar nome obrigatório, remover espaços extras e limitar o tamanho para evitar quebra do cartão.
- A alteração afeta somente o nome exibido na Central; e-mail, login, senha, permissões e empresas vinculadas permanecem iguais.
- Somente a proprietária/superadministradora poderá editar. As demais administradoras apenas visualizam.
- Se ainda não houver nome personalizado, usar temporariamente a identificação derivada do e-mail.

## Persistência e segurança
- Criar uma estrutura própria para nomes de exibição, vinculada ao identificador da usuária, sem guardar função ou permissão no perfil.
- Permitir leitura apenas à equipe autenticada autorizada e escrita somente à superadministradora, com políticas e permissões explícitas.
- Disponibilizar a atualização por uma operação protegida no backend e atualizar os cartões imediatamente após salvar.
- Incluir o nome de exibição nas consultas da Central sem alterar a lógica que define a responsável principal.

## Preservações
- Não alterar percentuais, cálculos, situações, filtros ou distribuição de empresas.
- Não alterar PDFs, Dashboard, relatórios, conciliação, fechamento ou dados financeiros.
- Não alterar o nome da conta ou o acesso das administradoras.
- Preservar os modos claro e noturno.

## Validação
- Confirmar edição, salvamento, cancelamento, persistência após recarregar e restrição para administradora comum.
- Conferir nome longo, métrica indisponível, cartão expandido e lista de empresas.
- Validar a grade em computador e celular, nos modos claro e noturno.
- Confirmar que filtros e o botão **Acessar** continuam funcionando.

## Reversão
A mudança visual ficará concentrada na seção **Por Responsável**. A estrutura de nomes poderá ser ignorada sem afetar os e-mails, acessos, responsáveis atuais ou qualquer dado financeiro.
