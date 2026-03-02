import { supabase } from '../supabaseClient';

export const logService = {
  create: async (action, details = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('logs').insert([{
      user_email: session?.user?.email || 'unknown',
      action,
      details
    }]);
  }
};

export const udoService = {
  getAll: async () => {
    const { data, error } = await supabase.from('udos').select('*').order('name');
    if (error) throw error;
    return data;
  },
  save: async (udo) => {
    const { data, error } = await supabase.from('udos').upsert([udo]);
    if (error) throw error;
    await logService.create(udo.id ? 'UPDATE_UDO' : 'CREATE_UDO', udo);
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from('udos').delete().eq('id', id);
    if (error) throw error;
    await logService.create('DELETE_UDO', { id });
  }
};

export const facilityService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('facilities')
      .select('*, udos(name, color)')
      .order('name');
    if (error) throw error;
    return data.map(f => ({
      ...f,
      udo_name: f.udos?.name || 'Nessuna UDO',
      udo_color: f.udos?.color || '#cbd5e1'
    }));
  },
  save: async (facility) => {
    const { data, error } = await supabase.from('facilities').upsert([facility]);
    if (error) throw error;
    await logService.create(facility.id ? 'UPDATE_FACILITY' : 'CREATE_FACILITY', facility);
    return data;
  },
  delete: async (id) => {
    const { error } = await supabase.from('facilities').delete().eq('id', id);
    if (error) throw error;
    await logService.create('DELETE_FACILITY', { id });
  }
};