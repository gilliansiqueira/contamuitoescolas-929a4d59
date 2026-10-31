import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAll';

export interface ExpenseDetailTrip {
  id: string;
  school_id: string;
  group_id: string;
  trip_date: string;
  activity: string;
  paying_people: number;
  revenue: number;
  source_row_key: string;
}

export interface ExpenseDetailTripImport {
  groupName: string;
  tripDate: string;
  activity: string;
  payingPeople: number;
  revenue: number;
  sourceRowKey: string;
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function useExpenseDetailTrips(schoolId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['expense_detail_trips', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const rows = await fetchAllRows<any>(
        'expense_detail_trips',
        request => request.eq('school_id', schoolId).order('trip_date'),
      );
      return rows.map(row => ({
        ...row,
        paying_people: Number(row.paying_people || 0),
        revenue: Number(row.revenue || 0),
      })) as ExpenseDetailTrip[];
    },
  });

  const importTrips = async (rows: ExpenseDetailTripImport[]) => {
    if (!rows.length) return;
    const { data: currentGroups, error: groupsError } = await supabase
      .from('expense_detail_groups')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order');
    if (groupsError) throw groupsError;

    const groups = [...(currentGroups || [])];
    const names = Array.from(new Set(rows.map(row => row.groupName.trim()).filter(Boolean)));
    for (const name of names) {
      if (groups.some(group => normalized(group.name) === normalized(name))) continue;
      const { data, error } = await supabase
        .from('expense_detail_groups')
        .insert({ school_id: schoolId, name, sort_order: groups.length })
        .select()
        .single();
      if (error) throw error;
      groups.push(data);
    }

    const dates = rows.map(row => row.tripDate).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    if (!firstDate || !lastDate) return;

    const { error: deleteError } = await supabase
      .from('expense_detail_trips')
      .delete()
      .eq('school_id', schoolId)
      .gte('trip_date', firstDate)
      .lte('trip_date', lastDate);
    if (deleteError) throw deleteError;

    const payload = rows.map(row => {
      const group = groups.find(item => normalized(item.name) === normalized(row.groupName));
      if (!group) throw new Error(`Centro de custo não encontrado: ${row.groupName}`);
      return {
        school_id: schoolId,
        group_id: group.id,
        trip_date: row.tripDate,
        activity: row.activity,
        paying_people: row.payingPeople,
        revenue: row.revenue,
        source_row_key: row.sourceRowKey,
      };
    });

    for (let index = 0; index < payload.length; index += 500) {
      const { error } = await supabase.from('expense_detail_trips').insert(payload.slice(index, index + 500));
      if (error) throw error;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['expense_detail_trips', schoolId] }),
      queryClient.invalidateQueries({ queryKey: ['expense_detail_groups', schoolId] }),
    ]);
  };

  return { trips: query.data || [], isLoading: query.isLoading, importTrips };
}