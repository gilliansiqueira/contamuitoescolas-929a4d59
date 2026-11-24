# Uberlândia: pendências do cliente + guia ilustrado para franqueados

## 1. Liberar pendências (igual Dourados)
- Ligar entradas e saídas nas duas empresas: Uberlândia Centro e Uberlândia Santa Mônica.
- O cliente murilo@uberlandia.com já tem acesso às duas. Ele vai ver o sininho e o item "Pendências" no menu, sem precisar publicar.
- A resposta dele continua sendo só uma anotação: não classifica, não concilia e não muda nenhum valor.

## 2. Guia ilustrado em PDF (serve para qualquer franqueado)
Um PDF curto, com prints reais da plataforma e setas/destaques, em linguagem simples:
1. Como entrar (endereço, e-mail, senha, "esqueci minha senha").
2. Como trocar de empresa (quem tem mais de uma, como o Murilo).
3. Tour pelas telas: Visão Geral/Dashboard, Resultados, Indicadores, Fluxo.
4. Pendências: sininho, filtros Todas/Entradas/Saídas, como responder e o "Enviado em".
5. Como instalar o app no celular:
   - iPhone (Safari): Compartilhar → "Adicionar à Tela de Início".
   - Android (Chrome): menu ⋮ → "Instalar app" / "Adicionar à tela inicial".
6. Dúvidas: com quem falar.

Os prints serão feitos com um cliente de teste e dados de uma empresa de exemplo, para não mostrar números de outro franqueado. O cliente de teste é apagado no fim.

## Entregas
- Pendências ligadas nas duas Uberlândias.
- `guia_franqueado.pdf` para baixar e mandar no WhatsApp/e-mail.
- Uma mensagem pronta curta para enviar junto.

## Detalhes técnicos
- `school_features` (cliente_pendencias_saidas, cliente_pendencias_entradas, enabled) para cc50b7b2… e ac69fe70….
- Prints via Playwright (desktop 1280 e celular 390x844), montagem do PDF em /mnt/documents. As telas de instalação do celular serão ilustradas (o app usa manifest já existente).
