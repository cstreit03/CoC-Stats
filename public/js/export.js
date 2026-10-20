/**
 * Excel and PDF export. Libraries load on first use so normal page loads stay light.
 */

const LIBS = {
    xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'],
    pdf: [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
    ]
};
const loaded = {};

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Could not load ${src}`));
        document.head.appendChild(s);
    });
}

async function ensure(lib) {
    loaded[lib] ??= LIBS[lib].reduce((p, src) => p.then(() => loadScript(src)), Promise.resolve());
    return loaded[lib];
}

/**
 * The PDF's built-in font only covers Latin-1: accents are dropped
 * (Việt -> Viet) and other scripts fall back to '?'.
 */
const pdfText = (v) => typeof v !== 'string' ? v : v.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * sheets: [{ name, header: [...], body: [[...]], cols?: [widths], cells?: (ws, XLSX) => void }]
 * A body cell may be { f: 'FORMULA', v: cachedValue } to write a live formula.
 */
export async function exportExcel(title, sheets) {
    await ensure('xlsx');
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    for (const sheet of sheets) {
        const aoa = [sheet.header, ...sheet.body.map(row => row.map(c => (c && typeof c === 'object' && 'f' in c) ? null : c))];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        sheet.body.forEach((row, r) => row.forEach((c, ci) => {
            if (c && typeof c === 'object' && 'f' in c) {
                ws[XLSX.utils.encode_cell({ r: r + 1, c: ci })] = { t: typeof c.v === 'string' ? 's' : 'n', f: c.f, v: c.v ?? 0 };
            }
        }));
        ws['!cols'] = (sheet.cols || sheet.header.map(h => Math.max(10, String(h).length + 2))).map(w => ({ wch: w }));
        if (sheet.header.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sheet.body.length, c: sheet.header.length - 1 } }) };
        sheet.cells?.(ws, XLSX);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
    }
    XLSX.writeFile(wb, `${slug(title)}-${stamp()}.xlsx`);
}

/**
 * Landscape PDF with a title, optional chart images and one or more tables.
 * tables: [{ title?, header, body }]
 */
export async function exportPdf(title, subtitle, tables, { charts = [] } = {}) {
    await ensure('pdf');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    let y = 40;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(pdfText(title), 40, y);
    y += 18;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
    const sub = doc.splitTextToSize(pdfText(`${subtitle}  ·  Exported ${new Date().toLocaleString()}`), W - 80);
    doc.text(sub, 40, y);
    doc.setTextColor(0);
    y += 12 * sub.length + 4;

    for (const canvas of charts) {
        if (!canvas) continue;
        const img = canvas.toDataURL('image/png', 1);
        const w = W - 80, h = Math.min(220, w * canvas.height / canvas.width);
        doc.addImage(img, 'PNG', 40, y, w, h);
        y += h + 14;
    }

    for (const t of tables) {
        if (t.title) { doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(pdfText(t.title), 40, y + 4); y += 12; }
        doc.autoTable({
            head: [t.header.map(pdfText)],
            body: t.body.map(r => r.map(c => pdfText((c && typeof c === 'object' && 'f' in c) ? c.v : c))),
            startY: y + 4,
            margin: { left: 40, right: 40 },
            styles: { fontSize: 8, cellPadding: 4 },
            headStyles: { fillColor: [33, 38, 51], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 246, 248] }
        });
        y = doc.lastAutoTable.finalY + 24;
    }
    doc.save(`${slug(title)}-${stamp()}.pdf`);
}

/** Wires [data-export] buttons in `root` to the given handlers, with a busy state. */
export function bindExports(root, { xlsx, pdf }) {
    root.querySelectorAll('[data-export]').forEach(btn => btn.addEventListener('click', async () => {
        const fn = btn.dataset.export === 'xlsx' ? xlsx : pdf;
        const label = btn.querySelector('span');
        const original = label.textContent;
        btn.disabled = true;
        label.textContent = 'Preparing…';
        try { await fn(); }
        catch (e) { console.error(e); alert(`Export failed: ${e.message}`); }
        finally { btn.disabled = false; label.textContent = original; }
    }));
}
