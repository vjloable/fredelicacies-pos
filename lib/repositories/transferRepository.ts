// Transfer Repository — cross-branch inventory movements.
// Mirrors orderRepository's structure (paginated list + subscribe).
import { supabase } from '@/lib/supabase';
import type {
  Transfer,
  TransferItem,
  TransferWithItems,
  TransferDirection,
  TransferStatus,
} from '@/types/domain/transfer';

interface TransferInsert {
  transfer_number: string;
  source_branch_id: string;
  destination_branch_id: string;
  direction: TransferDirection;
  created_by: string;
  fulfilled_at?: string | null;
  fulfilled_by?: string | null;
  note?: string | null;
}

interface TransferItemInsert {
  source_item_id: string;
  item_name: string;
  item_cost: number | null;
  item_price: number | null;
  category_names: string[];
  quantity_sent: number;
}

function mapRow(row: any): TransferWithItems {
  const items: TransferItem[] = (row.transfer_items || []).map((i: any) => ({
    id: i.id,
    transfer_id: i.transfer_id,
    source_item_id: i.source_item_id,
    destination_item_id: i.destination_item_id,
    item_name: i.item_name,
    item_cost: i.item_cost,
    item_price: i.item_price,
    category_names: i.category_names,
    quantity_sent: i.quantity_sent,
    quantity_received: i.quantity_received,
  }));
  return {
    id: row.id,
    transfer_number: row.transfer_number,
    source_branch_id: row.source_branch_id,
    destination_branch_id: row.destination_branch_id,
    direction: row.direction,
    status: row.status,
    created_by: row.created_by,
    fulfilled_at: row.fulfilled_at,
    fulfilled_by: row.fulfilled_by,
    received_at: row.received_at,
    received_by: row.received_by,
    cancelled_at: row.cancelled_at,
    cancelled_by: row.cancelled_by,
    cancel_reason: row.cancel_reason,
    fulfill_note: row.fulfill_note,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source_branch_name: row.source_branch?.name,
    destination_branch_name: row.destination_branch?.name,
    created_by_name: row.creator?.name,
    items,
  };
}

const SELECT_WITH_ITEMS = `
  *,
  transfer_items (*),
  source_branch:branches!transfers_source_branch_id_fkey (id, name),
  destination_branch:branches!transfers_destination_branch_id_fkey (id, name),
  creator:user_profiles!transfers_created_by_fkey (id, name)
`;

export const transferRepository = {
  async create(
    header: TransferInsert,
    lines: TransferItemInsert[]
  ): Promise<{ transfer: Transfer | null; error: any }> {
    const { data: transferRow, error: tErr } = await supabase
      .from('transfers')
      .insert(header)
      .select()
      .single();

    if (tErr || !transferRow) return { transfer: null, error: tErr };

    const itemsPayload = lines.map(l => ({
      transfer_id: transferRow.id,
      source_item_id: l.source_item_id,
      item_name: l.item_name,
      item_cost: l.item_cost,
      item_price: l.item_price,
      category_names: l.category_names,
      quantity_sent: l.quantity_sent,
    }));
    const { error: iErr } = await supabase.from('transfer_items').insert(itemsPayload);

    if (iErr) {
      // Manual rollback: delete header so we don't leak orphans.
      await supabase.from('transfers').delete().eq('id', transferRow.id);
      return { transfer: null, error: iErr };
    }

    return { transfer: transferRow as Transfer, error: null };
  },

  async getById(id: string): Promise<{ transfer: TransferWithItems | null; error: any }> {
    const { data, error } = await supabase
      .from('transfers')
      .select(SELECT_WITH_ITEMS)
      .eq('id', id)
      .single();
    return { transfer: data ? mapRow(data) : null, error };
  },

  async getByBranch(
    branchId: string,
    options?: {
      role?: 'source' | 'destination' | 'either';
      status?: TransferStatus;
      direction?: TransferDirection;
      limit?: number;
    }
  ): Promise<{ transfers: TransferWithItems[]; error: any }> {
    const role = options?.role ?? 'either';
    let query = supabase
      .from('transfers')
      .select(SELECT_WITH_ITEMS)
      .order('created_at', { ascending: false });

    if (role === 'source') query = query.eq('source_branch_id', branchId);
    else if (role === 'destination') query = query.eq('destination_branch_id', branchId);
    else query = query.or(`source_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`);

    if (options?.status) query = query.eq('status', options.status);
    if (options?.direction) query = query.eq('direction', options.direction);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    return { transfers: (data || []).map(mapRow), error };
  },

  async getAll(options?: {
    status?: TransferStatus;
    sourceBranchId?: string;
    destinationBranchId?: string;
    limit?: number;
  }): Promise<{ transfers: TransferWithItems[]; error: any }> {
    let query = supabase
      .from('transfers')
      .select(SELECT_WITH_ITEMS)
      .order('created_at', { ascending: false });
    if (options?.status) query = query.eq('status', options.status);
    if (options?.sourceBranchId) query = query.eq('source_branch_id', options.sourceBranchId);
    if (options?.destinationBranchId) query = query.eq('destination_branch_id', options.destinationBranchId);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    return { transfers: (data || []).map(mapRow), error };
  },

  async updateStatus(
    id: string,
    update: {
      status?: TransferStatus;
      fulfilled_at?: string | null;
      fulfilled_by?: string | null;
      fulfill_note?: string | null;
      cancelled_at?: string | null;
      cancelled_by?: string | null;
      cancel_reason?: string | null;
    }
  ): Promise<{ error: any }> {
    const { error } = await supabase.from('transfers').update(update).eq('id', id);
    return { error };
  },

  // Lightweight subscription — fires callback on inserts/updates targeting either side of branchId.
  subscribeOnly(branchId: string, callback: () => void): (() => void) {
    const channel = supabase
      .channel(`transfers-notify-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transfers',
          filter: `source_branch_id=eq.${branchId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transfers',
          filter: `destination_branch_id=eq.${branchId}`,
        },
        callback
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  },
};
