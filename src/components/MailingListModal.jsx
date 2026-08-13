// src/components/MailingListModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Mail, Download } from 'lucide-react';

const ROLE_FIELDS = [
  { role: 'Direttori',        nameField: 'director',            emailField: 'email_direzione'           },
  { role: 'Dir. Sanitari',    nameField: 'director_sanitario',  emailField: 'email_sanitario'           },
  { role: 'Ref. Struttura',   nameField: 'referente_struttura', emailField: 'email_referente_struttura' },
  { role: 'Ref. Qualità',     nameField: 'referent',            emailField: 'email_qualita'             },
];

export default function MailingListModal({ isOpen, onClose, facilities, udos, year }) {
  const [selectedMailRole, setSelectedMailRole] = useState('Direttori');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMailRole('Direttori');
  }, [isOpen]);

  if (!isOpen) return null;

  const currentRole = ROLE_FIELDS.find(r => r.role === selectedMailRole);
  const mailingList = facilities
    .filter(f => !f.is_suspended && f[currentRole.emailField])
    .map(f => ({
      name:    f.name,
      contact: f[currentRole.nameField] || '—',
      email:   f[currentRole.emailField],
      udo:     udos.find(u => u.id === f.udo_id)?.name || '—',
    }))
    .sort((a, b) => a.udo.localeCompare(b.udo) || a.name.localeCompare(b.name));

  const missingEmail = facilities.filter(f => !f.is_suspended && !f[currentRole.emailField]);

  const handleExportMailing = () => {
    const rows = [
      ['Struttura', 'UDO', 'Nome', 'Email'],
      ...mailingList.map(r => [r.name, r.udo, r.contact, r.email]),
    ];
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `mailing_${selectedMailRole.replace(/\s/g, '_')}_${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMailtoAll = () => {
    window.location.href = `mailto:?bcc=${mailingList.map(r => r.email).join(';')}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">

        {/* Header */}
        <div className="bg-slate-950 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-rose-600 rounded-lg text-white"><Mail size={22} /></div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Mailing List</h2>
              <p className="text-xs text-rose-400 font-bold uppercase tracking-widest">Destinatari per invii di gruppo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={26} /></button>
        </div>

        {/* Contenuto */}
        <div className="flex-1 overflow-y-auto bg-white p-8 min-h-0">
          <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
              {ROLE_FIELDS.map(r => (
                <button key={r.role} onClick={() => setSelectedMailRole(r.role)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    selectedMailRole === r.role ? 'bg-rose-600 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  {r.role}
                </button>
              ))}
              <div className="ml-auto flex gap-2">
                <button onClick={handleMailtoAll} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-indigo-700 transition-colors"><Mail size={13} /> Scrivi a tutti</button>
                <button onClick={handleExportMailing} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-700 transition-colors"><Download size={13} /> Export CSV</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-600"><span className="text-2xl font-black text-rose-600">{mailingList.length}</span> email presenti</span>
              {missingEmail.length > 0 && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  ⚠ {missingEmail.length} strutture senza email {selectedMailRole}
                </span>
              )}
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>{['Struttura','UDO','Nome','Email'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-black text-slate-500 uppercase tracking-widest">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mailingList.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-800">{r.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-bold uppercase">{r.udo}</td>
                      <td className="px-4 py-3 text-slate-600">{r.contact}</td>
                      <td className="px-4 py-3"><a href={`mailto:${r.email}`} className="text-indigo-600 hover:underline font-medium">{r.email}</a></td>
                    </tr>
                  ))}
                  {mailingList.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-bold">Nessuna email per questa categoria</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {missingEmail.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-2">Strutture senza email {selectedMailRole}</p>
                <div className="flex flex-wrap gap-2">
                  {missingEmail.map(f => <span key={f.id} className="text-xs bg-white border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg font-medium">{f.name}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
