CREATE TABLE public.lolli_import_batches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES public.schools(id), source_file text NOT NULL, source_kind text NOT NULL DEFAULT 'lolli_export', imported_at timestamptz NOT NULL DEFAULT now(), manifest jsonb NOT NULL DEFAULT '{}', source_company jsonb NOT NULL DEFAULT '{}', last_sync text);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.lolli_import_batches TO authenticated; GRANT ALL ON public.lolli_import_batches TO service_role;
ALTER TABLE public.lolli_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY team ON public.lolli_import_batches FOR ALL TO authenticated USING (public.is_admin() AND public.user_has_school_access(auth.uid(),school_id)) WITH CHECK (public.is_admin() AND public.user_has_school_access(auth.uid(),school_id));
CREATE POLICY restricted_company ON public.lolli_import_batches AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id));
DO $migration$
DECLARE t record; name text;
BEGIN
FOR t IN SELECT * FROM (VALUES
('acquirer_sales','id uuid PRIMARY KEY, adquirente text, external_id text, data text, valor numeric, bandeira text, nsu text, pedido_ref text, cliente text, status text, arquivo_nome text, pedido_aprovado text, created_at text, chargeback boolean, alerta_resolvido_em text, alerta_resolvido_por text'),
('card_fees_manuais','id uuid PRIMARY KEY, data text, taxa_credito numeric, taxa_debito numeric, observacao text, created_at text, updated_at text'),
('cash_flow_entries','id uuid PRIMARY KEY, external_id text, data_lancamento text, descricao text, fornecedor_cliente text, tipo text, valor numeric, conta_olist text, categoria_olist text, status text, expense_id text, rule_id text, import_id text, created_at text, updated_at text'),
('cash_flow_rules','id uuid PRIMARY KEY, match_text text, match_type text, expense_type text, categoria text, acertos numeric, created_at text, updated_at text'),
('chargebacks','id uuid PRIMARY KEY, pedido text, cliente text, operadora text, valor numeric, data_debito text, prazo_contestacao text, status text, motivo text, observacao text, origem text, created_at text, updated_at text, external_ref text'),
('devolucoes_venda','id uuid PRIMARY KEY, external_id text, data_devolucao text, numero_nota text, olist_devolucao_id text, cliente text, valor numeric, valor_produtos numeric, valor_frete numeric, situacao text, observacoes text, created_at text, updated_at text'),
('expense_category_groups','id uuid PRIMARY KEY, categoria text, grupo text, created_at text, updated_at text'),
('expenses','id uuid PRIMARY KEY, import_id text, data_despesa text, categoria text, descricao text, valor numeric, tipo text, recorrente boolean, created_at text'),
('folha_mes','id uuid PRIMARY KEY, funcionario_id text, mes text, dias_trabalhados numeric, beneficios jsonb, liquido_holerite numeric, holerite_arquivo text, pago_em text, created_at text, updated_at text'),
('fretes_manuais','id uuid PRIMARY KEY, mes text, valor numeric, observacao text, created_at text, updated_at text'),
('fretes_transportadora','id uuid PRIMARY KEY, transportadora text, data_envio text, codigo_rastreio text, pedido_numero text, destinatario text, servico text, peso numeric, valor numeric, external_id text, arquivo_nome text, created_at text, updated_at text'),
('funcionarios','id uuid PRIMARY KEY, nome text, cpf text, cargo text, ativo boolean, pix_tipo text, pix_chave text, banco text, beneficios jsonb, created_at text, updated_at text'),
('gateway_fee_periods','id uuid PRIMARY KEY, gateway text, ano_mes text, import_id text, qtd_transacoes numeric, total_bruto numeric, total_taxas numeric, total_liquido numeric, created_at text, updated_at text, primeira_data text, ultima_data text'),
('gateway_fees','id uuid PRIMARY KEY, gateway text, data_transacao text, bandeira text, tipo_transacao text, parcelas numeric, valor_bruto numeric, valor_taxa numeric, valor_liquido numeric, external_id text, import_id text, created_at text'),
('import_templates','id uuid PRIMARY KEY, tipo text, nome text, mapeamento jsonb, created_at text'),
('impostos_manuais','id uuid PRIMARY KEY, mes text, valor numeric, observacao text, created_at text, updated_at text'),
('issue_comments','id uuid PRIMARY KEY, transaction_id text, user_id text, autor_nome text, texto text, anexo_path text, created_at text'),
('manual_revenues','id uuid PRIMARY KEY, data text, canal text, vendedor text, valor numeric, observacao text, created_by text, created_at text, updated_at text'),
('marketing_spend','id uuid PRIMARY KEY, import_id text, data_mkt text, plataforma text, campanha text, investimento numeric, receita_atribuida numeric, compras numeric, observacoes text, created_at text'),
('olist_ignored_pedidos','id uuid PRIMARY KEY DEFAULT gen_random_uuid(), olist_pedido_id text, motivo text, created_at text'),
('product_costs','id uuid PRIMARY KEY, product_id text, custo numeric, vigencia_inicio text, observacoes text, created_at text'),
('products','id uuid PRIMARY KEY, sku text, nome text, created_at text, updated_at text, preco_lista numeric, preco_lista_sync text'),
('sales','id uuid PRIMARY KEY, import_id text, data_venda text, canal text, plataforma text, external_id text, cliente text, produto text, sku text, quantidade numeric, valor_bruto numeric, desconto numeric, valor_liquido numeric, frete_cobrado numeric, status text, forma_pagamento text, created_at text, frete_empresa numeric, marketplace text, taxa_marketplace numeric, data_faturamento text, data_envio text, codigo_rastreio text, olist_pedido_id text, provisorio boolean, vendedor text, pagamentos_detalhe jsonb, numero_ecommerce text'),
('bank_source','id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_table text NOT NULL, source_id text NOT NULL, original jsonb NOT NULL')
) AS tables(table_name,columns) LOOP
 name := 'lolli_' || t.table_name;
 EXECUTE format('CREATE TABLE public.%I (%s, school_id uuid NOT NULL REFERENCES public.schools(id), origem_upload_id uuid NOT NULL REFERENCES public.lolli_import_batches(id) ON DELETE CASCADE, source_kind text NOT NULL DEFAULT ''lolli_export'', source_file text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now())',name,t.columns);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',name);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',name);
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
 EXECUTE format('CREATE POLICY team ON public.%I FOR ALL TO authenticated USING (public.is_admin() AND public.user_has_school_access(auth.uid(),school_id)) WITH CHECK (public.is_admin() AND public.user_has_school_access(auth.uid(),school_id))',name);
 EXECUTE format('CREATE POLICY restricted_company ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_see_school(school_id)) WITH CHECK (public.can_see_school(school_id))',name);
 EXECUTE format('CREATE INDEX ON public.%I (school_id)',name);
 EXECUTE format('CREATE INDEX ON public.%I (origem_upload_id)',name);
END LOOP;
END $migration$;