import React, { useState, useMemo } from 'react';
import { X, LayoutGrid, Filter, PieChart as PieIcon, BarChart2 } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { KPI_RULES, KPI_SECTORS, isNumericSettore } from '../config/kpiRules';
import { computeKpiValue } from '../utils/kpiFormulaEngine';
import { MONTHS } from '../config/constants';

const MONTH_NAMES = MONTHS.map(m => m.name);
const PALETTE = ['#0D3B66', '#A8DADC', '#457B9D', '#2A9D8F', '#136F63', '#1D3557', '#e76f51', '#f4a261', '#e9c46a', '#264653'];

export default function KpiChartsModal({ isOpen, onClose, facilities, udos = [], kpiRecords, year }) {
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() === 0 ? 12 : new Date().getMonth()));
  const [selectedUdos, setSelectedUdos] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [activeTab, setActiveTab] = useState('ASSET');
  const [hiddenSeries, setHiddenSeries] = useState({}); // Stato per accendere/spegnere la legenda

  const availableRegions = useMemo(() => {
    const regs = facilities.map(f => f.areageografica || f.region || f.regione).filter(Boolean);
    return [...new Set(regs)].sort();
  }, [facilities]);

  const toggleUdo = (id) => setSelectedUdos(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  const toggleRegion = (reg) => setSelectedRegions(prev => prev.includes(reg) ? prev.filter(r => r !== reg) : [...prev, reg]);

  // 1. FILTRAGGIO STRUTTURE BASE (Nessuna duplicazione temporale)
  const filteredFacilities = useMemo(() => {
    let list = facilities.filter(f => !f.is_suspended);
    if (selectedUdos.length > 0) {list = list.filter(f => selectedUdos.includes(f.udo_id));}
    if (selectedRegions.length > 0) {list = list.filter(f => selectedRegions.includes(f.areageografica || f.region || f.regione));}
    return list;
  }, [facilities, selectedUdos, selectedRegions]);

  // 2. DATI PER TAB "ASSET"
  const assetData = useMemo(() => {
    const byUdo = {};
    const byRegion = {};

    filteredFacilities.forEach(f => {
      const udoName = udos.find(u => String(u.id) === String(f.udo_id))?.name || 'N/A';
      const regName = f.areageografica || f.region || f.regione || 'N/A';
      const beds = f.bed_count || f.posti_letto || 0;

      byUdo[udoName] = (byUdo[udoName] || 0) + beds;
      byRegion[regName] = (byRegion[regName] || 0) + beds;
    });

    return {
      udo: Object.entries(byUdo).map(([name, value]) => ({ name, value })).filter(d => d.value > 0),
      region: Object.entries(byRegion).map(([name, value]) => ({ name, value })).filter(d => d.value > 0),
      totalBeds: filteredFacilities.reduce((sum, f) => sum + (f.bed_count || f.posti_letto || 0), 0)
    };
  }, [filteredFacilities, udos]);

  // 3. DATI PER ISTOGRAMMI (Normalizzazione Matematica)
  const chartData = useMemo(() => {
    const list = filteredFacilities.map(f => {
      const udoName = udos.find(u => String(u.id) === String(f.udo_id))?.name || 'N/A';
      const record = kpiRecords.find(k => String(k.facility_id) === String(f.id) && Number(k.year) === year && Number(k.month) === selectedMonth && k.status === 'completed');

      // La property 'name' ora include la UDO per raggruppamento visivo sull'asse X
      const dataPoint = { rawName: f.name, name: `[${udoName}] ${f.name}`, udo: udoName, PostiLetto: f.bed_count || f.posti_letto || 0 };

      if (record && record.metrics_json) {
        // CALCOLO KPI REALI (motore centralizzato)
        // Include HR (Lavoratori, Addetti Cucina) calcolati tramite kpiRules settore HR
        KPI_RULES.forEach(rule => {
          const val = computeKpiValue(rule, record.metrics_json, f);
          if (val !== null) {
            dataPoint[rule.kpi_target] = val;
          }
        });
      }
      return dataPoint;
    });

    // Ordinamento rigoroso: Prima per UDO, poi per Nome Struttura
    list.sort((a, b) => {
      if (a.udo < b.udo) {return -1;}
      if (a.udo > b.udo) {return 1;}
      return a.rawName.localeCompare(b.rawName);
    });

    return list;
  }, [filteredFacilities, udos, kpiRecords, year, selectedMonth]);

  // Identifica quali colonne mostrare in base al TAB
  const currentChartKeys = useMemo(() => {
    if (activeTab === 'ASSET') {return [];}
    if (activeTab === 'OVERVIEW') {return ['PostiLetto', 'Lavoratori', 'Addetti Cucina'];}

    const sectorRules = KPI_RULES.filter(r => r.settore === activeTab);
    const expectedKeys = sectorRules.map(r => r.kpi_target);

    const availableKeys = new Set();
    chartData.forEach(d => {
      Object.keys(d).forEach(k => {
        if (expectedKeys.includes(k)) {availableKeys.add(k);}
      });
    });
    return Array.from(availableKeys);
  }, [activeTab, chartData]);

  // Gestione clic sulla legenda
  const handleLegendClick = (e) => {
    const { dataKey } = e;
    setHiddenSeries(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  if (!isOpen) {return null;}

  const isPercTab = activeTab !== 'ASSET' && activeTab !== 'OVERVIEW' && !isNumericSettore(activeTab);

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-[95vw] h-[95vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-sky-600 rounded-lg text-white"><LayoutGrid size={24} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Dashboard Quantitativa Normalizzata</h2>
              <p className="text-xs text-sky-400 font-bold uppercase tracking-widest">Confronto Performance tra Strutture</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={26} /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* SIDEBAR SINISTRA: FILTRI */}
          <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Filter size={14}/> Periodo</h3>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-sky-500 cursor-pointer shadow-sm">
                {MONTH_NAMES.map((m, i) => <option key={i} value={i+1}>{m} {year}</option>)}
              </select>
            </div>

            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Filtro UDO</h3>
              <div className="flex flex-col gap-2">
                <button onClick={() => setSelectedUdos([])} className={`text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedUdos.length === 0 ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>Tutte le UDO</button>
                {udos.map(u => (
                  <button key={u.id} onClick={() => toggleUdo(u.id)} className={`text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedUdos.includes(u.id) ? 'bg-sky-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-600 hover:border-sky-400'}`}>
                    {u.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Filtro Regione</h3>
              <div className="flex flex-col gap-2">
                <button onClick={() => setSelectedRegions([])} className={`text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedRegions.length === 0 ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>Tutte le Regioni</button>
                {availableRegions.map(reg => (
                  <button key={reg} onClick={() => toggleRegion(reg)} className={`text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${selectedRegions.includes(reg) ? 'bg-sky-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-600 hover:border-sky-400'}`}>
                    {reg}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AREA PRINCIPALE: TABS E GRAFICI */}
          <div className="flex-1 flex flex-col bg-white min-w-0">

            <div className="flex gap-2 p-4 border-b border-slate-100 overflow-x-auto custom-scrollbar shrink-0 bg-slate-50/50">
              <button onClick={() => setActiveTab('ASSET')} className={`shrink-0 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'ASSET' ? 'bg-sky-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                <PieIcon size={14} /> Asset
              </button>
              <button onClick={() => setActiveTab('OVERVIEW')} className={`shrink-0 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'OVERVIEW' ? 'bg-sky-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                <BarChart2 size={14} /> Overview HR
              </button>
              <div className="w-px h-8 bg-slate-300 mx-2 self-center"></div>
              {KPI_SECTORS.map(s => (
                <button key={s} onClick={() => setActiveTab(s)} className={`shrink-0 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === s ? 'bg-slate-800 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                  {s}
                </button>
              ))}
            </div>

            <div className="flex-1 p-8">

              {/* TAB ASSET (Torte con Totale Centrale) */}
              {activeTab === 'ASSET' && (
                <div className="flex h-full gap-8">
                  <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 p-6 relative">
                    <h3 className="text-center text-sm font-black uppercase tracking-widest text-slate-700 mb-4">Posti Letto per UDO</h3>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Totale</span>
                       <span className="text-3xl font-black text-slate-800">{assetData.totalBeds}</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={assetData.udo} cx="50%" cy="50%" innerRadius={90} outerRadius={140} paddingAngle={2} dataKey="value" label={({name, value}) => `${name}: ${value}`}>
                          {assetData.udo.map((entry, index) => <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex-1 flex flex-col bg-slate-50 rounded-2xl border border-slate-200 p-6 relative">
                    <h3 className="text-center text-sm font-black uppercase tracking-widest text-slate-700 mb-4">Posti Letto per Regione</h3>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Totale</span>
                       <span className="text-3xl font-black text-slate-800">{assetData.totalBeds}</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={assetData.region} cx="50%" cy="50%" innerRadius={90} outerRadius={140} paddingAngle={2} dataKey="value" label={({name, value}) => `${name}: ${value}`}>
                          {assetData.region.map((entry, index) => <Cell key={`cell-${index}`} fill={PALETTE[(index + 4) % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* TAB ISTOGRAMMI */}
              {activeTab !== 'ASSET' && (
                currentChartKeys.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    <BarChart2 size={48} className="mb-4 opacity-50" />
                    <p className="font-black uppercase tracking-widest">Nessun indicatore calcolabile per "{activeTab}"</p>
                    <p className="text-xs font-bold mt-2">Le strutture filtrate non hanno consolidato questi dati nel mese selezionato.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 40, right: 30, left: 20, bottom: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      {/* Asse X: Mostra [UDO] Nome Struttura per chiarire il raggruppamento */}
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{fontSize: 10, fontWeight: 'bold', fill: '#475569'}} interval={0} />
                      <YAxis tick={{fontSize: 10, fontWeight: 'bold', fill: '#475569'}} />
                      <Tooltip
                        cursor={{fill: '#f8fafc'}}
                        formatter={(value) => isPercTab ? `${value}%` : value}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}
                      />
                      <Legend
                        onClick={handleLegendClick}
                        wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        iconType="circle"
                      />

                      {currentChartKeys.map((key, index) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          fill={PALETTE[index % PALETTE.length]}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={60}
                          hide={hiddenSeries[key] === true}
                        >
                          <LabelList
                            dataKey={key}
                            position="top"
                            style={{ fontSize: '10px', fontWeight: '900', fill: '#334155' }}
                            formatter={(val) => isPercTab ? `${val}%` : val}
                          />
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}