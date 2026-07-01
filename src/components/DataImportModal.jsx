import React, { useState, useEffect } from 'react';
import { X, Upload, FileType, AlertCircle, CheckCircle2, Loader2, Building2, Home, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

export default function DataImportModal({ isOpen, onClose, facility, type, year, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [uploadScope, setUploadScope] = useState('company');
  const [mappings, setMappings] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // IL NUOVO SELETTORE TEMPORALE: Impostato di default su Dicembre (12)
  const [selectedMonth, setSelectedMonth] = useState('12');

  useEffect(() => {
    if (isOpen) {
      const fetchMappings = async () => {
        const { data, error } = await supabase
          .from('survey_mappings')
          .select('*')
          .eq('type', type);
        if (!error && data) {
          setMappings(data);
          if (data.length === 0) {
            setStatus({ type: 'error', msg: `ATTENZIONE: Nessun mapping trovato nel database per la categoria ${type.toUpperCase()}. L'importazione fallirà.` });
          } else {
            setStatus({ type: '', msg: '' });
          }
        }
      };
      fetchMappings();
    }
  }, [isOpen, type]);

  if (!isOpen) {return null;}

const normalizeValue = (raw, mappingRule) => {
    if (raw === null || raw === undefined || raw === '') {return null;}
    const rawStr = String(raw).toLowerCase().trim();

    // DIZIONARIO DI TRADUZIONE SEMANTICA (Il tuo nuovo salvavita)
    const textToNum = {
      'scarse': 1, 'poco chiare': 2, 'sufficienti': 3, 'chiare': 4, 'molto chiare e dettagliate': 5,
      'insoddisfatto': 1, 'per nulla soddisfatto': 1, 'poco soddisfatto': 2, 'soddisfatto': 4, 'molto soddisfatto': 5,
      'per nulla soddisfatte': 1, 'poco soddisfatte': 2, 'soddisfatte': 4, 'molto soddisfatte': 5,
      'insufficiente': 1, 'sufficiente': 3, 'buono': 4, 'ottimo': 5,
      'mai': 1, 'raramente': 2, 'qualche volta': 3, 'spesso': 4, 'sempre': 5,
      'no': 1, 'si': mappingRule.scale_max || 10
    };

    let val = null;

    // 1. Cerca un match testuale diretto
    if (textToNum[rawStr] !== undefined) {
      val = textToNum[rawStr];
    } else {
      // 2. Se non trova il testo, cerca il numero classico
      const match = rawStr.match(/\d+/);
      if (match) {val = parseInt(match[0]);}
    }

    if (val === null) {return null;}

    const max = mappingRule.scale_max || 10;
    const min = 1;

    // Se sfora, scartiamo per non sporcare i dati
    if (val > max || val < min) {return null;}

    // Normalizzazione a 100
    if (mappingRule.is_inverse) {
      return Math.round(((max - val) / (max - min)) * 100);
    }
    return Math.round(((val - min) / (max - min)) * 100);
  };

  const getTokens = (text) => {
    if (!text) {return [];}
    return text.toString()
      .toLowerCase()
      .replace(/[^\w\sàèìòùáéíóú]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (mappings.length === 0) {return;}
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
        setFile(droppedFile);
        setStatus({ type: '', msg: '' });
      } else {
        setStatus({ type: 'error', msg: 'Formato non supportato. Usa file Excel (.xlsx)' });
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {return;}

    if (uploadScope === 'company' && !facility.company_id) {
      setStatus({ type: 'error', msg: 'Errore Strutturale: Questa sede non è associata ad alcuna società nel Database.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', msg: 'Estrazione a Matrice Assoluta in corso...' });

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const targetSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('responses')) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[targetSheetName];

        const rawArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        let headerRowIndex = -1;
        for(let i = 0; i < Math.min(20, rawArray.length); i++) {
          const rowArray = rawArray[i] || [];
          const rowStr = rowArray.map(cell => String(cell || '')).join(' ').toLowerCase();

          if ((rowStr.includes('risposta') && rowStr.includes('iniziata')) || rowStr.includes('lavori')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          throw new Error("Impossibile trovare le intestazioni. Il file non contiene le parole chiave di Zoho ('risposta', 'lavori').");
        }

        const headers = rawArray[headerRowIndex].map(h => String(h || '').trim());

        const rawData = [];
        for(let i = headerRowIndex + 1; i < rawArray.length; i++) {
          const rowArr = rawArray[i] || [];
          let isEmpty = true;
          const rowObj = {};

          headers.forEach((h, colIdx) => {
            if (h && h !== '') {
              rowObj[h] = rowArr[colIdx];
              if (rowArr[colIdx] !== null && rowArr[colIdx] !== undefined && String(rowArr[colIdx]).trim() !== '') {
                isEmpty = false;
              }
            }
          });

          if (!isEmpty) {rawData.push(rowObj);}
        }

        if (rawData.length === 0) {
          throw new Error('Trovate le domande, ma non ci sono risposte valide sottostanti.');
        }

        let activeMapping = null;
        let headerMap = {};

        for (const m of mappings) {
          const mappingKeys = Object.keys(m.mapping_json);
          let matchCount = 0;
          const tempMap = {};

          mappingKeys.forEach(mKey => {
            const mTokens = getTokens(mKey);
            if(mTokens.length === 0) {return;}

            let bestHeader = null;
            let highestScore = 0;

            headers.forEach(h => {
              if(!h) {return;}
              const hTokens = getTokens(h);
              const matches = mTokens.filter(t => hTokens.includes(t)).length;
              const score = matches / mTokens.length;

              if (score > highestScore) {
                highestScore = score;
                bestHeader = h;
              }
            });

            if (highestScore >= 0.60) {
              matchCount++;
              tempMap[bestHeader] = mKey;
            }
          });

          if (matchCount >= (mappingKeys.length * 0.5)) {
            activeMapping = m;
            headerMap = tempMap;
            break;
          }
        }

        if (!activeMapping) {
          const sampleHeader = headers.find(h => h && h.length > 15) || headers[2];
          throw new Error(`Mapping fallito. Intestazione estratta: "${sampleHeader}". Verifica di avere il mapping su Supabase e di cliccare il tasto giusto.`);
        }

        const processedData = rawData.map(row => {
          const cleanRow = {};
          Object.keys(row).forEach(header => {
            const mappedRuleKey = headerMap[header];
            if (mappedRuleKey) {
              const rule = activeMapping.mapping_json[mappedRuleKey];
              const normVal = normalizeValue(row[header], rule);
              if (normVal !== null) {
                cleanRow[rule.id] = normVal;
              }
            }
          });
          return cleanRow;
        }).filter(row => Object.keys(row).length > 0);

        if (processedData.length === 0) {throw new Error('Nessun voto numerico valido trovato nelle risposte.');}

        // IL NUOVO MOTORE DI SALVATAGGIO TEMPORALE
        const payload = {
          type: type,
          year: year,
          calendar_id: `${year}-${selectedMonth}`, // <-- AGGANCIO ALLA DIMENSIONE CALENDARIO
          responses_json: processedData,
          summary_stats: {
            total_responses: processedData.length,
            mapping_used: activeMapping.mapping_name,
            source: activeMapping.source_table ?? activeMapping.table_name ?? 'survey_data',
          }
        };

        if (uploadScope === 'facility') {
          payload.facility_id = facility.id;
          payload.company_id = facility.company_id || null;
        } else {
          payload.facility_id = null;
          payload.company_id = facility.company_id;
        }

        // AGGIORNATO IL VINCOLO DI CONFLITTO A CALENDAR_ID
        const { error } = await supabase
          .from('survey_data')
          .upsert(payload, { onConflict: 'facility_id, type, calendar_id' });

        if (error) {throw error;}

        setStatus({ type: 'success', msg: `BINGO! Caricate ${processedData.length} risposte per ${selectedMonth}/${year}.` });
        setTimeout(() => {
          onUploadSuccess();
          onClose();
        }, 2000);

      } catch (err) {
        console.error(err);
        setStatus({ type: 'error', msg: err.message });
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const months = [
    {val: '01', label: 'Gennaio'}, {val: '02', label: 'Febbraio'}, {val: '03', label: 'Marzo'},
    {val: '04', label: 'Aprile'}, {val: '05', label: 'Maggio'}, {val: '06', label: 'Giugno'},
    {val: '07', label: 'Luglio'}, {val: '08', label: 'Agosto'}, {val: '09', label: 'Settembre'},
    {val: '10', label: 'Ottobre'}, {val: '11', label: 'Novembre'}, {val: '12', label: 'Dicembre'}
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
          <div>
            <h2 className="text-xl font-black text-indigo-900 uppercase italic">Import Dati Analitici</h2>
            <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">
              {facility.name} • {type === 'client' ? 'Clienti' : 'Operatori'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">

          <div className="flex flex-col gap-4 mb-6">
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
              <button
                onClick={() => setUploadScope('facility')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  uploadScope === 'facility' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Home size={16} /> Singola Struttura
              </button>
              <button
                onClick={() => setUploadScope('company')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  uploadScope === 'company' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Building2 size={16} /> Intera Società
              </button>
            </div>

            {/* SELETTORE DEL MESE INIETTATO QUI */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <Calendar size={18} className="text-indigo-500" />
              <span className="text-sm font-bold text-slate-600 uppercase">Periodo:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-black text-indigo-900 outline-none flex-1 cursor-pointer"
              >
                {months.map(m => (
                  <option key={m.val} value={m.val}>{m.label} {year}</option>
                ))}
              </select>
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
              mappings.length === 0 ? 'border-rose-300 bg-rose-50 cursor-not-allowed opacity-70' :
              isDragging ? 'border-indigo-600 bg-indigo-100 scale-105' :
              file ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50'
            }`}
          >
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                setFile(e.target.files[0]);
                setStatus({ type: '', msg: '' });
              }}
              className="hidden"
              id="excel-upload"
              disabled={mappings.length === 0}
            />
            <label htmlFor="excel-upload" className={`flex flex-col items-center w-full ${mappings.length === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              {file ? <FileType size={48} className="text-indigo-600 mb-4" /> : <Upload size={48} className={`mb-4 transition-colors ${isDragging ? 'text-indigo-600' : 'text-slate-300'}`} />}
              <span className="text-sm font-bold text-center text-slate-700 pointer-events-none">
                {file ? file.name : isDragging ? 'Rilascia il file qui!' : 'Trascina qui il file XLSX'}
              </span>
              {!file && <span className="text-xs text-slate-400 mt-2 pointer-events-none">Estrazione Matrice Assoluta Attiva</span>}
            </label>
          </div>

          {status.msg && (
            <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 text-sm font-bold leading-snug ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
              status.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
            }`}>
              {status.type === 'success' ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> :
               status.type === 'error' ? <AlertCircle size={18} className="shrink-0 mt-0.5" /> :
               <Loader2 size={18} className="shrink-0 mt-0.5 animate-spin" />}
              <p>{status.msg}</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || loading || mappings.length === 0}
            className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            {loading ? 'Elaborazione...' : 'Analizza e Salva Dati'}
          </button>
        </div>
      </div>
    </div>
  );
}