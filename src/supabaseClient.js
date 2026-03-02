import { createClient } from '@supabase/supabase-js'

// Carichiamo le variabili d'ambiente (il prefisso REACT_APP_ è obbligatorio per React)
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRORE CRITICO: Variabili d'ambiente Supabase mancanti. Controlla il file .env o le impostazioni di Vercel.");
}

export const supabase = createClient(supabaseUrl, supabaseKey)