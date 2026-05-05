// src/utils/createUserDirect.js
import { supabase } from '../supabaseClient';

function generateTempPassword() {
  return 'TempPass_' + Math.random().toString(36).slice(2, 10) + '!';
}

export async function createUserDirect({ email, role, facilityId, companyId }) {
  const password = generateTempPassword();

  // 1. Crea utente in auth
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, company_id: companyId },
      emailRedirectTo: undefined,
    },
  });
  if (signUpError) throw signUpError;

  const userId = signUpData?.user?.id;
  if (!userId) throw new Error('Creazione utente fallita: nessun ID restituito');

  // 2. Inserisce profilo
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert([{
      id:         userId,
      email,
      role,
      company_id: companyId ?? null,
    }]);
  if (profileError) throw profileError;

  // 3. Associa alla struttura
  if (facilityId) {
    const { error: accessError } = await supabase
      .from('user_facility_access')
      .insert([{
        user_id:     userId,
        facility_id: facilityId,
      }]);
    if (accessError) throw accessError;
  }

  return { userId, email, password };
}
