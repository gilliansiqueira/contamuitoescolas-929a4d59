import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SAChannel, SAOrder, SAOrderItem, SAPaymentMethod, SAProduct } from './types';

export function useSAProducts(schoolId: string) {
  return useQuery({
    queryKey: ['sa_products', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_analysis_products')
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as SAProduct[];
    },
  });
}

export function useSAChannels(schoolId: string) {
  return useQuery({
    queryKey: ['sa_channels', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_analysis_channels')
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as SAChannel[];
    },
  });
}

export function useSAPaymentMethods(schoolId: string) {
  return useQuery({
    queryKey: ['sa_payment_methods', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_analysis_payment_methods')
        .select('*')
        .eq('school_id', schoolId)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as SAPaymentMethod[];
    },
  });
}

export function useSAOrders(schoolId: string) {
  return useQuery({
    queryKey: ['sa_orders', schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_analysis_orders')
        .select('*')
        .eq('school_id', schoolId)
        .order('order_date', { ascending: false });
      if (error) throw error;
      return (data || []) as SAOrder[];
    },
  });
}

export function useSAOrderItems(schoolId: string) {
  return useQuery({
    queryKey: ['sa_order_items', schoolId],
    queryFn: async () => {
      // join via orders for school_id
      const { data: orders } = await supabase
        .from('sales_analysis_orders')
        .select('id')
        .eq('school_id', schoolId);
      const orderIds = (orders || []).map(o => o.id);
      if (orderIds.length === 0) return [] as SAOrderItem[];
      const { data, error } = await supabase
        .from('sales_analysis_order_items')
        .select('*')
        .in('order_id', orderIds);
      if (error) throw error;
      return (data || []) as SAOrderItem[];
    },
  });
}

export function useDeleteOrder(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.from('sales_analysis_orders').delete().eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sa_orders', schoolId] });
      qc.invalidateQueries({ queryKey: ['sa_order_items', schoolId] });
    },
  });
}
