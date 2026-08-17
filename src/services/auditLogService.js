import { supabase } from '../supabaseClient';

export async function getAuditLog({ page = 0, pageSize = 50, tableName = null } = {}) {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('performed_at', { ascending: false })
    .range(from, to);

  if (tableName) query = query.eq('table_name', tableName);

  const { data, error, count } = await query;
  if (error) throw error;

  // audit_log.performed_by referenzia auth.users, non user_profiles:
  // niente embed automatico via PostgREST, risolviamo a parte.
  const userIds = [...new Set((data ?? []).map(r => r.performed_by).filter(Boolean))];
  let usersById = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .in('id', userIds);
    usersById = Object.fromEntries((users ?? []).map(u => [u.id, u]));
  }

  const rows = (data ?? []).map(r => ({
    ...r,
    utente_label: usersById[r.performed_by]?.full_name || usersById[r.performed_by]?.email || '—',
  }));

  return { rows, total: count ?? 0 };
}

export function computeDiff(oldData, newData) {
  if (!oldData) return Object.entries(newData ?? {}).map(([campo, dopo]) => ({ campo, prima: null, dopo }));
  if (!newData) return Object.entries(oldData ?? {}).map(([campo, prima]) => ({ campo, prima, dopo: null }));
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  return [...keys]
    .filter(k => JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]))
    .map(campo => ({ campo, prima: oldData[campo], dopo: newData[campo] }));
}
