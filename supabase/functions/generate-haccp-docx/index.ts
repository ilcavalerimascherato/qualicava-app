// supabase/functions/generate-haccp-docx/index.ts
// Genera manuale HACCP in formato .docx usando docx (npm)
// Restituisce il buffer binario del file Word

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Colori OVER ───────────────────────────────────────────────
const VERDE        = '1D6F42';
const VERDE_LIGHT  = 'E8F5EE';
const GRIGIO_TESTO = '4A4A4A';
const NERO         = '1A1A1A';

// ── Carica logo dal bucket Storage ───────────────────────────
async function caricaLogo(variante: string, supabaseUrl: string, supabaseKey: string): Promise<{ data: Uint8Array; type: string; w: number; h: number } | null> {
  const logoMap: Record<string, { path: string; type: string; w: number; h: number }> = {
    A: { path: '_templates/loghi/intestazione.jpeg', type: 'jpg', w: 160, h: 80  },
    B: { path: '_templates/loghi/pittogramma.jpg',   type: 'jpg', w: 80,  h: 80  },
  };
  const cfg = logoMap[variante] || logoMap['A'];
  try {
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/haccp-documents/${cfg.path}`,
      { headers: { Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return { data: new Uint8Array(buf), type: cfg.type, w: cfg.w, h: cfg.h };
  } catch {
    return null;
  }
}

// ── Parser markdown → struttura paragrafi ────────────────────
function parseTesto(rawText: string): string {
  // Restituisce HTML semplice che verrà convertito
  // In questo contesto restituiamo il testo strutturato per docx
  return rawText;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const params = await req.json();
    const {
      nomestruttura  = '[NOME STRUTTURA]',
      osa            = '[OSA]',
      pivaOsa        = '—',
      modello        = 'Cucina interna',
      lr             = '—',
      rHaccp         = '—',
      teamHaccp      = [],
      numRev         = '1',
      dataRev        = new Date().toLocaleDateString('it-IT'),
      redattore      = 'Ufficio Qualità OVER',
      noteRevisione  = 'Prima emissione',
      testoManuale   = '',
      logoVariante   = 'A',
    } = params;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    // Carica logo
    const logo = await caricaLogo(logoVariante, supabaseUrl, supabaseKey);

    // Usa docx via CDN esm.sh (Deno-compatible)
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
            ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
            ShadingType, VerticalAlign, PageBreak, TabStopType, SimpleField } =
      await import('https://esm.sh/docx@9.6.1');

    const PAGE_W   = 11906;
    const PAGE_H   = 16838;
    const MARGIN   = 1134;
    const CONTENT_W = PAGE_W - MARGIN * 2;

    const bord = { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' };
    const borders = { top: bord, bottom: bord, left: bord, right: bord };

    function cella(t: string, w: number, hdr = false) {
      return new TableCell({
        width: { size: w, type: WidthType.DXA }, borders,
        shading: { fill: hdr ? VERDE : (t === '' ? 'FAFAFA' : 'FFFFFF'), type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: t, font: 'Arial', size: hdr ? 18 : 20, bold: hdr, color: hdr ? 'FFFFFF' : NERO })] })],
      });
    }

    function labelCell(t: string, w: number) {
      return new TableCell({
        width: { size: w, type: WidthType.DXA }, borders,
        shading: { fill: VERDE_LIGHT, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: t, font: 'Arial', size: 20, bold: true, color: VERDE })] })],
      });
    }

    const c1 = Math.floor(CONTENT_W * 0.35);
    const c2 = CONTENT_W - c1;

    // Tabella dati documento
    const teamRighe = (teamHaccp as { ruolo: string; nome?: string }[])
      .filter(m => m.ruolo)
      .map(m => new TableRow({ children: [labelCell(m.ruolo, c1), cella(m.nome || '—', c2)] }));

    const tabellaDoc = new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [c1, c2],
      rows: [
        new TableRow({ children: [labelCell('Struttura', c1),             cella(nomestruttura, c2)] }),
        new TableRow({ children: [labelCell('Ragione sociale OSA', c1),   cella(osa, c2)] }),
        new TableRow({ children: [labelCell('P.IVA OSA', c1),             cella(pivaOsa, c2)] }),
        new TableRow({ children: [labelCell('Modello ristorazione', c1),  cella(modello, c2)] }),
        new TableRow({ children: [labelCell('Legale Rappresentante', c1), cella(lr, c2)] }),
        new TableRow({ children: [labelCell('Responsabile HACCP', c1),    cella(rHaccp, c2)] }),
        ...teamRighe,
        new TableRow({ children: [labelCell('N° Revisione', c1),          cella(numRev, c2)] }),
        new TableRow({ children: [labelCell('Data emissione', c1),        cella(dataRev, c2)] }),
        new TableRow({ children: [labelCell('Redatto da', c1),            cella(redattore, c2)] }),
      ],
    });

    // Tabella registro revisioni
    const cR = 600, cD = 1200, cRed = 1800, cDesc = CONTENT_W - 600 - 1200 - 1800 - 1600, cApp = 1600;
    const registroRevisioni = new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [cR, cD, cRed, cDesc, cApp],
      rows: [
        new TableRow({ children: [cella('Rev.', cR, true), cella('Data', cD, true), cella('Redatto da', cRed, true), cella('Descrizione variazioni', cDesc, true), cella('Approvato da', cApp, true)] }),
        new TableRow({ height: { value: 500, rule: 'exact' }, children: [cella(numRev, cR), cella(dataRev, cD), cella(redattore, cRed), cella(noteRevisione, cDesc), cella(lr, cApp)] }),
        ...Array.from({ length: 4 }, () => new TableRow({ height: { value: 500, rule: 'exact' }, children: [cella('', cR), cella('', cD), cella('', cRed), cella('', cDesc), cella('', cApp)] })),
      ],
    });

    // Header pagine interne
    const headerChildren: InstanceType<typeof Paragraph>[] = [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: VERDE, space: 4 } },
        spacing: { after: 120 },
        children: [
          ...(logo ? [new ImageRun({ data: logo.data, transformation: { width: Math.round(logo.w * 0.5), height: Math.round(logo.h * 0.5) }, type: logo.type as 'jpg' | 'png' })] : [new TextRun({ text: 'GRUPPO OVER', font: 'Arial', size: 20, bold: true, color: VERDE })]),
          new TextRun({ text: '  MANUALE HACCP', font: 'Arial', size: 18, bold: true, color: VERDE }),
        ],
      }),
    ];

    const header = new Header({ children: headerChildren });

    // Footer
    const footer = new Footer({
      children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: VERDE, space: 4 } },
        spacing: { before: 80 },
        children: [
          new TextRun({ text: nomestruttura, font: 'Arial', size: 18, color: GRIGIO_TESTO }),
          new TextRun({ text: '\t', size: 18 }),
          new TextRun({ text: 'Pagina ', font: 'Arial', size: 18, color: GRIGIO_TESTO }),
          new SimpleField('PAGE', new TextRun({ font: 'Arial', size: 18, color: GRIGIO_TESTO })),
        ],
      })],
    });

    // Copertina
    const copertina: InstanceType<typeof Paragraph | typeof Table>[] = [
      ...(logo ? [new Paragraph({ children: [new ImageRun({ data: logo.data, transformation: { width: logo.w, height: logo.h }, type: logo.type as 'jpg' | 'png' })] })] : []),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 1 } },
        children: [new TextRun({ text: '', size: 10 })],
      }),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),
      new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'MANUALE HACCP', font: 'Arial', size: 52, bold: true, color: VERDE })] }),
      new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'Sistema di Autocontrollo Alimentare', font: 'Arial', size: 28, italic: true, color: VERDE })] }),
      new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'Reg. CE 852/2004 — D.Lgs 27/2021', font: 'Arial', size: 20, color: '888888' })] }),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),
      tabellaDoc,
      new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: 'I dati personali raccolti verranno trattati ai sensi del Regolamento UE n. 679/2016 (GDPR).', font: 'Arial', size: 16, italic: true, color: '999999' })] }),
      new Paragraph({ children: [new PageBreak()] }),
      // Pag 2: Registro revisioni
      new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: 'REGISTRO DELLE REVISIONI', font: 'Arial', size: 22, bold: true, color: VERDE })] }),
      registroRevisioni,
      new Paragraph({ children: [new PageBreak()] }),
    ];

    // Corpo manuale (parser markdown)
    const corpo: InstanceType<typeof Paragraph>[] = [];
    for (const line of testoManuale.split('\n')) {
      const t = line.trim();
      if (!t) { corpo.push(new Paragraph({ children: [new TextRun({ text: '' })] })); continue; }
      if (t.startsWith('# ') || t.startsWith('## ')) {
        corpo.push(new Paragraph({
          pageBreakBefore: t.startsWith('# '),
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: VERDE, space: 4 } },
          spacing: { before: 320, after: 160 },
          children: [new TextRun({ text: t.replace(/^#{1,2}\s+/, ''), font: 'Arial', size: t.startsWith('# ') ? 32 : 26, bold: true, color: VERDE })],
        }));
      } else if (t.startsWith('### ')) {
        corpo.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: t.replace(/^###\s+/, ''), font: 'Arial', size: 22, bold: true, color: VERDE })] }));
      } else if (t.match(/^[-•*]\s+/)) {
        corpo.push(new Paragraph({
          indent: { left: 360, hanging: 240 },
          spacing: { after: 80 },
          children: [new TextRun({ text: '• ', font: 'Arial', size: 22, color: VERDE, bold: true }), new TextRun({ text: t.replace(/^[-•*]\s+/, ''), font: 'Arial', size: 22, color: GRIGIO_TESTO })],
        }));
      } else {
        corpo.push(new Paragraph({ spacing: { after: 140, line: 300 }, children: [new TextRun({ text: t, font: 'Arial', size: 22, color: GRIGIO_TESTO })] }));
      }
    }

    const doc = new Document({
      styles: { default: { document: { run: { font: 'Arial', size: 22, color: NERO } } } },
      sections: [
        {
          properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
          children: copertina,
        },
        {
          properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 1000, right: MARGIN, bottom: 1000, left: MARGIN } } },
          headers: { default: header },
          footers: { default: footer },
          children: corpo,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Manuale_HACCP_${nomestruttura.replace(/\s+/g, '_')}_Rev${numRev}.docx"`,
      },
    });

  } catch (err) {
    console.error('generate-haccp-docx error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
