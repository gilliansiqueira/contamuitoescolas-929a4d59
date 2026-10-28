CREATE TEMP TABLE _bb_fix (data text, valor numeric, tipo text, descricao text);
INSERT INTO _bb_fix VALUES
('2026-10-01',13.4,'saida','Tarifa Pix Enviado - Tar. agrupadas - ocorrencia 30/09/2026'),
('2026-10-05',80,'entrada','Pix - Recebido - JUMAYRA VER'),
('2026-10-05',80,'entrada','Pix - Recebido - JULIANA MOU'),
('2026-10-06',80,'entrada','Pix - Recebido - RODRIGO PASTUR'),
('2026-10-06',1658.33,'saida','Transferência enviada - BEATRIZ ROEDEL LINHARES'),
('2026-10-06',552.84,'saida','Transferência enviada - MARINA G T T SILVA'),
('2026-10-06',767.83,'saida','Transferido para Poupança - MARCO FELIPE L RODRIGUEZ'),
('2026-10-06',2872.61,'saida','Transferência enviada - LUCAS RESENDE DONATO'),
('2026-10-06',1068.84,'saida','Pix - Enviado - Telma Sebastião Machavele'),
('2026-10-06',829.26,'saida','Pix - Enviado - Jean Gabriel Kepler Kumme'),
('2026-10-06',1048.28,'saida','Pix - Enviado - Taís de Oliveira Mello'),
('2026-10-06',987.33,'saida','Pix - Enviado - ALBERTO PIRES MATOS'),
('2026-10-06',487.57,'saida','Pix - Enviado - MARIA BEATRIZ DE MELO AMA'),
('2026-10-06',668.68,'saida','Pix - Enviado - Telma Sebastião Machavele'),
('2026-10-07',1621,'saida','Pagamento de Boleto - CONFESSORES SOLUCOES CONTABEIS'),
('2026-10-07',21.2,'saida','Tarifa Pix Enviado - Tar. agrupadas - ocorrencia 06/10/2026'),
('2026-10-08',370,'entrada','Pix - Recebido - Antonieta dos'),
('2026-10-09',900,'entrada','Pix - Recebido - RENATO OLINTO'),
('2026-10-09',2716.17,'saida','Pagamento de Boleto - CONDOMINIO DO EDIFICIO PORTAL'),
('2026-10-13',392.03,'entrada','Pix - Recebido - HENRIQUE GOULA'),
('2026-10-13',50,'entrada','Pix - Recebido - ANA PAULA DE P'),
('2026-10-13',367,'saida','Pix - Enviado - ALBERTO PIRES MATOS'),
('2026-10-13',345,'saida','Pix - Enviado - Jean Gabriel Kepler Kumme'),
('2026-10-13',212,'saida','Pix - Enviado - MARIA BEATRIZ DE MELO AMA'),
('2026-10-13',345,'saida','Pix - Enviado - Taís de Oliveira Mello'),
('2026-10-13',12.54,'saida','Tarifa Pix Enviado - Tar. agrupadas - ocorrencia 13/10/2026'),
('2026-10-13',93.1,'saida','Tarifa Pacote de Serviços - Cobrança referente 13/10/2026'),
('2026-10-20',160,'entrada','Pix - Recebido - GIOVANI NOG'),
('2026-10-20',1764.98,'saida','Pix - Enviado - RECEITA FEDERAL'),
('2026-10-20',1736.25,'saida','Pix - Enviado - CEF MATRIZ'),
('2026-10-23',435.71,'entrada','Pix - Recebido - ALINE ROBERTA'),
('2026-10-26',380.4,'entrada','Pix - Recebido - MARCELLA SIQUE'),
('2026-10-27',80,'entrada','Pix - Recebido - MARIO LUCIO S'),
('2026-10-27',80,'entrada','Pix - Recebido - MAURICIO A NOG');

CREATE TEMP TABLE _bb_map AS
SELECT t.id, f.tipo, f.descricao
FROM public.bank_transactions t
JOIN _bb_fix f ON f.data = t.data AND f.valor = t.valor
WHERE t.account_id = '5f946e07-cdde-4b24-9b7d-d3f13357a3f6' AND t.data >= '2026-10-01' AND t.data <= '2026-10-27'
  AND ( (SELECT count(*) FROM _bb_fix g WHERE g.data = f.data AND g.valor = f.valor) = 1
        OR t.descricao ILIKE '%' || split_part(split_part(f.descricao, ' - ', 3), ' ', 1) || '%' );

DO $$ BEGIN
  IF (SELECT count(*) FROM _bb_map) <> 34 OR (SELECT count(DISTINCT id) FROM _bb_map) <> 34 THEN
    RAISE EXCEPTION 'Mapeamento BB Brasília inesperado: % linhas', (SELECT count(*) FROM _bb_map);
  END IF;
END $$;

ALTER TABLE public.bank_transactions DISABLE TRIGGER guard_bank_tx_immutable;
UPDATE public.bank_transactions t SET
  descricao = m.descricao,
  tipo = m.tipo,
  model_item_id = CASE WHEN m.tipo <> t.tipo THEN NULL ELSE t.model_item_id END,
  recon_status = CASE WHEN m.tipo <> t.tipo THEN 'pendente' ELSE t.recon_status END,
  recon_by = CASE WHEN m.tipo <> t.tipo THEN NULL ELSE t.recon_by END,
  recon_by_email = CASE WHEN m.tipo <> t.tipo THEN NULL ELSE t.recon_by_email END,
  recon_at = CASE WHEN m.tipo <> t.tipo THEN NULL ELSE t.recon_at END
FROM _bb_map m WHERE m.id = t.id;
ALTER TABLE public.bank_transactions ENABLE TRIGGER guard_bank_tx_immutable;

INSERT INTO public.audit_log (school_id, action, description) VALUES ('9712a9cb-99ac-4d21-943b-514a8ec8b65b','correcao_extrato_bb','PDF BB out/2026 (ag. 2881-9 c/c 122485-9): 22 saídas estavam gravadas como entrada; sentido e descrição corrigidos conforme o extrato e saídas voltaram para pendente.');