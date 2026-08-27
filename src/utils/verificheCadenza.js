/**
 * src/utils/verificheCadenza.js
 * ─────────────────────────────────────────────────────────────
 * Cadenza strutturata per i template di verifica — non testuale, così il
 * sistema calcola deterministicamente la prossima scadenza invece di
 * interpretare un'etichetta libera.
 *
 * Modello: cadenza_unita ('giorni'|'settimane'|'mesi') + cadenza_intervallo
 * (ogni N unità) + un'ancora opzionale (giorno_settimana per le settimane,
 * giorno_mese per i mesi). Copre: ogni giorno/ogni N giorni, settimanale con
 * giorno fisso, mensile/bimestrale/trimestrale/semestrale/annuale/biennale
 * con giorno del mese fisso (tutti "ogni N mesi" con N diverso).
 *
 * Completamente agnostico rispetto a React.
 * ─────────────────────────────────────────────────────────────
 */

const GIORNI_SETTIMANA = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

/**
 * Calcola la prossima scadenza di un template a partire dall'ultima
 * esecuzione (o da oggi, se non è mai stato eseguito).
 *
 * @param {Object} template - { cadenza_unita, cadenza_intervallo, cadenza_giorno_settimana, cadenza_giorno_mese }
 * @param {string|Date|null} ultimaEsecuzione - data dell'ultima sessione, o null se mai eseguito
 * @returns {Date}
 */
export function computeNextDueDate(template, ultimaEsecuzione) {
  const { cadenza_unita, cadenza_intervallo, cadenza_giorno_settimana, cadenza_giorno_mese } = template;
  const base = ultimaEsecuzione ? new Date(ultimaEsecuzione) : null;

  // Mai eseguito: la prima scadenza è la prossima occorrenza dell'ancora
  // (se presente) da oggi, altrimenti oggi stesso.
  if (!base) {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    if (cadenza_unita === 'settimane' && cadenza_giorno_settimana != null) {
      return nextWeekday(oggi, cadenza_giorno_settimana);
    }
    if (cadenza_unita === 'mesi' && cadenza_giorno_mese != null) {
      return nextMonthDay(oggi, cadenza_giorno_mese, 0);
    }
    return oggi;
  }

  base.setHours(0, 0, 0, 0);

  if (cadenza_unita === 'giorni') {
    const next = new Date(base);
    next.setDate(next.getDate() + cadenza_intervallo);
    return next;
  }

  if (cadenza_unita === 'settimane') {
    const next = new Date(base);
    next.setDate(next.getDate() + cadenza_intervallo * 7);
    if (cadenza_giorno_settimana != null) return nextWeekday(next, cadenza_giorno_settimana);
    return next;
  }

  if (cadenza_unita === 'mesi') {
    if (cadenza_giorno_mese != null) {
      return nextMonthDay(base, cadenza_giorno_mese, cadenza_intervallo);
    }
    const next = new Date(base);
    next.setMonth(next.getMonth() + cadenza_intervallo);
    return next;
  }

  return base;
}

/** Prossima occorrenza di un giorno della settimana (0=domenica..6=sabato) a partire da `from` incluso. */
function nextWeekday(from, targetDay) {
  const d = new Date(from);
  const diff = (targetDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Aggiunge `mesiAvanti` mesi a `from` e fissa il giorno del mese a `giornoMese` (clampato a fine mese se necessario). */
function nextMonthDay(from, giornoMese, mesiAvanti) {
  const d = new Date(from.getFullYear(), from.getMonth() + mesiAvanti, 1);
  const ultimoGiornoMese = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(giornoMese, ultimoGiornoMese));
  return d;
}

/** Giorni di ritardo rispetto a oggi (positivo = scaduto, negativo = non ancora dovuto). */
export function daysOverdue(nextDueDate) {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((oggi - due) / (24 * 60 * 60 * 1000));
}

/** Etichetta leggibile della cadenza per la UI (sola visualizzazione, non usata per il calcolo). */
export function formatCadenza(template) {
  const { cadenza_unita, cadenza_intervallo, cadenza_giorno_settimana, cadenza_giorno_mese } = template;

  if (cadenza_unita === 'giorni') {
    return cadenza_intervallo === 1 ? 'Ogni giorno' : `Ogni ${cadenza_intervallo} giorni`;
  }
  if (cadenza_unita === 'settimane') {
    const giorno = cadenza_giorno_settimana != null ? ` (${GIORNI_SETTIMANA[cadenza_giorno_settimana]})` : '';
    return cadenza_intervallo === 1 ? `Settimanale${giorno}` : `Ogni ${cadenza_intervallo} settimane${giorno}`;
  }
  if (cadenza_unita === 'mesi') {
    const giorno = cadenza_giorno_mese != null ? ` il ${cadenza_giorno_mese}` : '';
    const NOMI = { 1: 'Mensile', 2: 'Bimestrale', 3: 'Trimestrale', 6: 'Semestrale', 12: 'Annuale', 24: 'Biennale' };
    const nome = NOMI[cadenza_intervallo] ?? `Ogni ${cadenza_intervallo} mesi`;
    return `${nome}${giorno}`;
  }
  return '—';
}
