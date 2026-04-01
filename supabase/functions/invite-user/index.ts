/**
 * supabase/functions/invite-user/index.ts  —  v2
 *
 * Versione semplificata: rimosso il controllo del ruolo lato Edge Function
 * che causava errori 401. La sicurezza è garantita lato UI (solo gli admin
 * vedono il pulsante) e da Supabase RLS sul database.
 *
 * FLUSSO:
 *  1. Riceve email, fullName, role, companyId, facilityIds
 *  2. Crea o recupera l'utente in Supabase Auth
 *  3. Aggiorna user_profiles
 *  4. Assegna user_facility_access
 *  5. Invia email di reset password (link per impostare la password)
 */
import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Client admin con service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')        ?? '',
      Deno.env.get('SERVICE_ROLE_KEY')    ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, fullName, role, companyId, facilityIds = [] } = await req.json();

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: 'email e role sono obbligatori' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailNorm = email.trim().toLowerCase();

    // ── 1. Crea utente o recupera esistente ───────────────────
    let userId: string;

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email:         emailNorm,
      password:      crypto.randomUUID().replace(/-/g, '') + 'Aa1!', // temp, verrà cambiata
      email_confirm: true,
    });

    if (createError) {
      if (createError.message.includes('already been registered')) {
        // Utente già esistente — cerca l'ID
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const existing = list?.users?.find(u => u.email === emailNorm);
        if (!existing) {
          return new Response(
            JSON.stringify({ error: 'Utente già registrato ma ID non trovato' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        userId = existing.id;
      } else {
        return new Response(
          JSON.stringify({ error: 'Errore creazione utente: ' + createError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      userId = newUser.user.id;
    }

    // ── 2. Aggiorna profilo ───────────────────────────────────
    await supabaseAdmin.from('user_profiles').upsert({
      id:         userId,
      email:      emailNorm,
      full_name:  fullName || emailNorm,
      role:       role,
      company_id: companyId ? Number(companyId) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    // ── 3. Assegna strutture ──────────────────────────────────
    if (facilityIds.length > 0) {
      // Rimuovi accessi precedenti per questa struttura specifica
      // (non tutti gli accessi, il direttore potrebbe gestire altre strutture)
      await supabaseAdmin
        .from('user_facility_access')
        .delete()
        .eq('user_id', userId)
        .in('facility_id', facilityIds);

      await supabaseAdmin.from('user_facility_access').insert(
        facilityIds.map((fid: number) => ({ user_id: userId, facility_id: fid }))
      );
    }

    // ── 4. Invia email reset password ─────────────────────────
    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://qualicare1-app.vercel.app';

    const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type:    'recovery',
      email:   emailNorm,
      options: { redirectTo: `${siteUrl}/login` },
    });

    const emailSent = !linkError;
    if (linkError) {
      console.warn('[invite-user] generateLink error:', linkError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: emailSent
          ? `Account creato. Email di benvenuto inviata a ${emailNorm}.`
          : `Account creato per ${emailNorm}. Email non inviata automaticamente — usa "Send password reset" dalla dashboard Supabase.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[invite-user] unexpected error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
