import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  HardDriveDownload,
  RotateCcw,
} from 'lucide-react';
import { useFinance, type ImportedTransactionRow } from '../context/FinanceContext';
import { exportOrDownloadFile } from '../lib/exportFile';
import { formatEuro, parseEuroToCents, toISODate, todayISO } from '../lib/format';
import type { TransactionKind } from '../types/finance';

function parseFlexibleExcelDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return toISODate(raw);
  }

  if (typeof raw === 'number' && raw > 25000 && raw < 80000) {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(
        parsed.d
      ).padStart(2, '0')}`;
    }
  }

  const str = String(raw).trim();
  // YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YY (Italian standard)
  const itMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (itMatch) {
    let year = Number(itMatch[3]);
    if (year < 100) year += 2000;
    const month = Number(itMatch[2]);
    const day = Number(itMatch[1]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

export function ImportExportView() {
  const {
    transactions,
    categories,
    accounts,
    importTransactionsBatch,
    exportBackupJSON,
    restoreBackupJSON,
  } = useFinance();

  // Excel / CSV Import Wizard State
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);

  const [colDate, setColDate] = useState<string>('');
  const [amountMode, setAmountMode] = useState<'single' | 'separate'>('single');
  const [colAmount, setColAmount] = useState<string>('');
  const [colKind, setColKind] = useState<string>('');
  const [colExpense, setColExpense] = useState<string>('');
  const [colIncome, setColIncome] = useState<string>('');
  const [colCategory, setColCategory] = useState<string>('');
  const [colSubcategory, setColSubcategory] = useState<string>('');
  const [colNote, setColNote] = useState<string>('');
  const [colAccount, setColAccount] = useState<string>('');

  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const loadSheetRows = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: true,
    });
    setRawRows(jsonRows);

    const cols =
      jsonRows.length > 0 ? Object.keys(jsonRows[0]).filter((k) => !k.startsWith('__EMPTY')) : [];
    const allCols = jsonRows.length > 0 ? Object.keys(jsonRows[0]) : cols;
    setHeaders(allCols);

    // Smart Italian / English column auto-detection
    const findCol = (patterns: RegExp[]) =>
      allCols.find((h) => patterns.some((p) => p.test(h.toLowerCase()))) || '';

    const detectedDate = findCol([/data/, /date/, /giorno/]);
    const detectedExp = findCol([/^spes/, /^uscit/, /addebito/, /dare/, /expense/]);
    const detectedInc = findCol([/^entrat/, /accredito/, /avere/, /income/]);
    const detectedAmt = findCol([/importo/, /ammontare/, /valore/, /euro/, /amount/, /totale/]);
    const detectedKind = findCol([/tipo/, /movimento/, /type/, /flusso/]);
    const detectedCat = findCol([/^categori/, /voce/, /category/]);
    const detectedSub = findCol([/sottocateg/, /subcat/, /dettaglio/]);
    const detectedNote = findCol([/not[ae]/, /descrizion/, /comment/, /causale/]);
    const detectedAcc = findCol([/conto/, /portafogli/, /account/]);

    setColDate(detectedDate || allCols[0] || '');
    if (detectedExp && detectedInc && !detectedAmt) {
      setAmountMode('separate');
      setColExpense(detectedExp);
      setColIncome(detectedInc);
    } else {
      setAmountMode('single');
      setColAmount(detectedAmt || detectedExp || allCols[1] || '');
      setColKind(detectedKind);
    }
    setColCategory(detectedCat);
    setColSubcategory(detectedSub);
    setColNote(detectedNote);
    setColAccount(detectedAcc);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      const first = wb.SheetNames[0] || '';
      setSelectedSheet(first);
      if (first) loadSheetRows(wb, first);
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Impossibile leggere il file Excel/CSV.',
      });
    }
  };

  const parsedPreview = useMemo<ImportedTransactionRow[]>(() => {
    if (rawRows.length === 0 || !colDate) return [];
    const results: ImportedTransactionRow[] = [];

    for (const row of rawRows) {
      const dateISO = parseFlexibleExcelDate(row[colDate]);
      if (!dateISO) continue;

      let kind: TransactionKind = 'expense';
      let amountCents = 0;

      if (amountMode === 'separate') {
        const expVal = colExpense ? parseEuroToCents(row[colExpense] as string | number) : null;
        const incVal = colIncome ? parseEuroToCents(row[colIncome] as string | number) : null;
        if (incVal && Math.abs(incVal) > 0) {
          kind = 'income';
          amountCents = Math.abs(incVal);
        } else if (expVal && Math.abs(expVal) > 0) {
          kind = 'expense';
          amountCents = Math.abs(expVal);
        } else {
          continue;
        }
      } else {
        const rawAmt = colAmount
          ? parseEuroToCents(row[colAmount] as string | number)
          : null;
        if (rawAmt === null || rawAmt === 0) continue;

        const kindRaw = colKind ? String(row[colKind] ?? '').toLowerCase() : '';
        if (/trasf|girocont|transfer/.test(kindRaw)) {
          kind = 'transfer';
        } else if (/entrat|accredit|stipendi|income|\+/.test(kindRaw)) {
          kind = 'income';
        } else if (/spes|uscit|addebit|expense|-/.test(kindRaw)) {
          kind = 'expense';
        } else {
          // Infer from sign: negative -> expense, positive -> expense unless kind column exists
          if (rawAmt < 0) kind = 'expense';
          else if (colKind) kind = 'expense';
          else {
            // If spreadsheet uses negative for expenses and positive for incomes, check if sheet has negatives
            const sheetHasNegatives = rawRows.some((r) => {
              const v = parseEuroToCents(r[colAmount] as string | number);
              return v !== null && v < 0;
            });
            kind = sheetHasNegatives ? 'income' : 'expense';
          }
        }
        amountCents = Math.abs(rawAmt);
      }

      results.push({
        kind,
        amountCents,
        occurredOn: dateISO,
        categoryName: colCategory ? String(row[colCategory] ?? '').trim() : undefined,
        subcategoryName: colSubcategory
          ? String(row[colSubcategory] ?? '').trim()
          : undefined,
        note: colNote ? String(row[colNote] ?? '').trim() : undefined,
        accountName: colAccount ? String(row[colAccount] ?? '').trim() : undefined,
      });
    }

    return results;
  }, [
    rawRows,
    colDate,
    amountMode,
    colAmount,
    colKind,
    colExpense,
    colIncome,
    colCategory,
    colSubcategory,
    colNote,
    colAccount,
  ]);

  const handleConfirmImport = async () => {
    if (parsedPreview.length === 0) return;
    setImporting(true);
    try {
      const res = await importTransactionsBatch(parsedPreview);
      setStatusMsg({
        type: 'success',
        text: `Importate con successo ${res.imported} operazioni! Le categorie mancanti sono state create automaticamente.`,
      });
      setWorkbook(null);
      setRawRows([]);
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Errore durante importazione',
      });
    } finally {
      setImporting(false);
    }
  };

  // Export Excel (.xlsx) & CSV
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const buildExportRows = () =>
    transactions.map((tx) => {
      const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
      const sub = tx.subcategoryId ? categoryMap.get(tx.subcategoryId) : undefined;
      const fromAcc = accountMap.get(tx.accountId);
      const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;
      return {
        Data: tx.occurredOn,
        Tipo:
          tx.kind === 'expense'
            ? 'Spesa'
            : tx.kind === 'income'
            ? 'Entrata'
            : 'Trasferimento',
        'Importo (€)':
          tx.kind === 'expense'
            ? -(tx.amountCents / 100)
            : tx.amountCents / 100,
        Categoria: cat?.name ?? '',
        Sottocategoria: sub?.name ?? '',
        Conto: fromAcc?.name ?? '',
        'Conto Destinazione': toAcc?.name ?? '',
        Nota: tx.note,
      };
    });

  const handleExportExcel = async () => {
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Operazioni');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await exportOrDownloadFile(
      `siki-budget-${todayISO()}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      new Uint8Array(out)
    );
  };

  const handleExportCSV = async () => {
    const rows = buildExportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
    await exportOrDownloadFile(
      `siki-budget-${todayISO()}.csv`,
      'text/csv;charset=utf-8',
      '\uFEFF' + csv
    );
  };

  const handleExportJSON = async () => {
    const json = await exportBackupJSON();
    await exportOrDownloadFile(
      `siki-budget-backup-${todayISO()}.json`,
      'application/json',
      json
    );
  };

  const handleRestoreJSONFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = await restoreBackupJSON(text);
    setStatusMsg(
      res.ok
        ? { type: 'success', text: 'Backup ripristinato con successo!' }
        : { type: 'error', text: res.error || 'Errore ripristino backup' }
    );
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Import Excel / CSV Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <FileUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Importa da Excel (.xlsx) o CSV
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Carica il tuo foglio Excel 2026: riconosciamo in automatico date, spese, entrate e categorie.
            </p>
          </div>
        </div>

        <label className="block w-full cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 p-4 text-center transition">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Tocca per scegliere un file .xlsx, .xls o .csv
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Column Mapping & Live Preview */}
        {workbook && headers.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {sheetNames.length > 1 && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Foglio Excel
                </label>
                <select
                  value={selectedSheet}
                  onChange={(e) => {
                    setSelectedSheet(e.target.value);
                    loadSheetRows(workbook, e.target.value);
                  }}
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {sheetNames.map((sn) => (
                    <option key={sn} value={sn}>
                      {sn}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Colonna Data *
                </label>
                <select
                  value={colDate}
                  onChange={(e) => setColDate(e.target.value)}
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold"
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Formato Importi
                </label>
                <select
                  value={amountMode}
                  onChange={(e) =>
                    setAmountMode(e.target.value as 'single' | 'separate')
                  }
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold"
                >
                  <option value="single">Colonna unica Importo</option>
                  <option value="separate">2 colonne (Spese / Entrate)</option>
                </select>
              </div>
            </div>

            {amountMode === 'single' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Colonna Importo *
                  </label>
                  <select
                    value={colAmount}
                    onChange={(e) => setColAmount(e.target.value)}
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold"
                  >
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Colonna Tipo (opz.)
                  </label>
                  <select
                    value={colKind}
                    onChange={(e) => setColKind(e.target.value)}
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold"
                  >
                    <option value="">Auto da segno (+/-)</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Colonna Spese/Uscite
                  </label>
                  <select
                    value={colExpense}
                    onChange={(e) => setColExpense(e.target.value)}
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold"
                  >
                    <option value="">--</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Colonna Entrate
                  </label>
                  <select
                    value={colIncome}
                    onChange={(e) => setColIncome(e.target.value)}
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold"
                  >
                    <option value="">--</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Categoria (opz.)
                </label>
                <select
                  value={colCategory}
                  onChange={(e) => setColCategory(e.target.value)}
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold"
                >
                  <option value="">-- Nessuna --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Nota / Descrizione (opz.)
                </label>
                <select
                  value={colNote}
                  onChange={(e) => setColNote(e.target.value)}
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-2 text-xs font-semibold"
                >
                  <option value="">-- Nessuna --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview Box */}
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Righe valide pronte da importare: {parsedPreview.length}
              </p>
              {parsedPreview.slice(0, 4).map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300"
                >
                  <span className="truncate pr-2">
                    {p.occurredOn} · {p.categoryName || 'Altro'}
                    {p.note ? ` (${p.note})` : ''}
                  </span>
                  <span
                    className={`font-bold tabular-nums shrink-0 ${
                      p.kind === 'income' ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {p.kind === 'income' ? '+' : '-'}
                    {formatEuro(p.amountCents)}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={parsedPreview.length === 0 || importing}
              onClick={handleConfirmImport}
              className="w-full py-3 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-xs disabled:opacity-40"
            >
              {importing
                ? 'Importazione in corso...'
                : `Importa ${parsedPreview.length} operazioni`}
            </button>
          </div>
        )}
      </div>

      {/* Export Excel & CSV */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Esporta Operazioni ({transactions.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scarica o condividi l&apos;intero storico per Excel o Google Sheets.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleExportExcel}
            className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            Esporta Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="py-3 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Full JSON Backup / Restore */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Backup Integrale Offline (.json)
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Salva conti, categorie, sottocategorie, budget, regole ricorrenti e operazioni in un unico file.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleExportJSON}
            className="py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5"
          >
            <HardDriveDownload className="w-4 h-4 text-emerald-500" />
            Scarica Backup
          </button>

          <label className="py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer">
            <RotateCcw className="w-4 h-4 text-amber-500" />
            Ripristina JSON
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreJSONFile}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
