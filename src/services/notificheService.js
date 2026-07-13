// src/services/notificheService.js
import { supabase } from '../supabaseClient';

export async function createNotifica(userId, tipo, titolo, messaggio, link) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{ user_id: userId, tipo, titolo, messaggio, link }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getNotifiche(userId, soloNonLette = false) {
  let q = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (soloNonLette) q = q.eq('letta', false);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function markAsRead(notificaId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ letta: true })
    .eq('id', notificaId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markAllAsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ letta: true })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getCountNonLette(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('letta', false);
  if (error) throw error;
  return count ?? 0;
}
