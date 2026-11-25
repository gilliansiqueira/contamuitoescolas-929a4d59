# Ather passa para a Tamires

## Como está hoje
- A Ather está na carteira da **Bia** e da **Tamires** (tamy@contamuito.com).
- Na Central, a responsável pela Ather é a **Bella** (bellacontamuito@gmail.com), que também tem a empresa na carteira.

## O que vou fazer
1. Tirar a Ather da carteira da Bia. Assim ela some também da visão da Thauane, que fica só com Sinop, Rio Verde e Londrina Dom Bosco.
2. Colocar a Tamires como responsável pela Ather na Central, no lugar da Bella.
3. Manter a Ather na carteira da Bella, a menos que você peça para tirar.
4. Conferir nos dados como ficaram as carteiras.

Nenhum lançamento, saldo ou cálculo da Ather muda.

## Detalhes técnicos
- Apagar a linha de `user_schools` que liga a Bia (f7ee955c…) à Ather (a7786ff0…).
- `school_management_settings.responsible_user_id` da Ather = Tamires (ae0f257e…).
