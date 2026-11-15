import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  HardDriveDownload,
  RotateCcw,
  Sparkles,
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
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(
        parsed.d
      ).padStart(2, '0')}`;
    }
  }

  const str = String(raw).trim();
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YY (Italian standard)
  const itMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (itMatch) {
    let year = Number(itMatch[3]);
    if (year < 100) year += 2000;
    let first = Number(itMatch[1]);
    let second = Number(itMatch[2]);
    // Handle MM/DD/YY if second > 12
    if (second > 12 && first <= 12) {
      const tmp = first;
      first = second;
      second = tmp;
    }
    const day = first;
    const month = second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

// Detect & parse native "Budget e finanze - spese" (ru.innim.my_finance) 3-sheet workbook
function tryParseBudgetEFinanzeWorkbook(
  wb: XLSX.WorkBook
): ImportedTransactionRow[] | null {
  const findSheet = (candidates: string[]) =>
    wb.SheetNames.find((sn) =>
      candidates.some((c) => sn.trim().toLowerCase() === c)
    );

  const expSheetName = findSheet(['spese', 'expenses', 'uscite']);
  const incSheetName = findSheet(['entrate', 'income', 'incomes']);
  const trfSheetName = findSheet(['bonifici', 'trasferimenti', 'transfers']);

  if (!expSheetName && !incSheetName) return null;

  const checkHasInnimHeaders = (sheetName?: string) => {
    if (!sheetName) return false;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: '',
    });
    return rows.slice(0, 5).some((r) =>
      Array.isArray(r) &&
      r.some((c) => /data e ora/i.test(String(c))) &&
      r.some((c) => /importo in valuta|importo nella valuta/i.test(String(c)))
    );
  };

  if (!checkHasInnimHeaders(expSheetName) && !checkHasInnimHeaders(incSheetName)) {
    return null;
  }

  const parsed: ImportedTransactionRow[] = [];

  const parseFlowSheet = (sheetName: string | undefined, kind: 'expense' | 'income') => {
    if (!sheetName) return;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: '',
    });
    const hIdx = rows.findIndex(
      (r) =>
        Array.isArray(r) &&
        r.some((c) => /data e ora|^data$/i.test(String(c).trim()))
    );
    if (hIdx === -1) return;
    const hdr = rows[hIdx].map((c) => String(c ?? '').trim().toLowerCase());

    const idxDate = hdr.findIndex((h) => /data/.test(h));
    const idxCat = hdr.findIndex((h) => /categori/.test(h));
    const idxAcc = hdr.findIndex((h) => /^conto$/.test(h));
    const idxAmt = hdr.findIndex((h) => /importo in valuta del conto|^importo/.test(h));
    const idxTxAmt = hdr.findIndex((h) => /importo in valuta della transazione/.test(h));
    const idxTag = hdr.findIndex((h) => /^tag$/.test(h));
    const idxComment = hdr.findIndex((h) => /comment|not[ae]|descriz/.test(h));

    for (let i = hIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r)) continue;
      const dateISO = parseFlexibleExcelDate(r[idxDate >= 0 ? idxDate : 0]);
      if (!dateISO) continue;

      const rawPrimary = idxAmt >= 0 ? r[idxAmt] : r[3];
      const rawFallback = idxTxAmt >= 0 ? r[idxTxAmt] : '';
      const cents = parseEuroToCents(
        (rawPrimary !== '' && rawPrimary !== null && rawPrimary !== undefined
          ? rawPrimary
          : rawFallback) as string | number
      );
      if (!cents || Math.abs(cents) === 0) continue;

      const catName = String(r[idxCat >= 0 ? idxCat : 1] ?? '').trim() || 'Altro';
      const accName = String(r[idxAcc >= 0 ? idxAcc : 2] ?? '').trim() || 'Principale';
      const tag = idxTag >= 0 ? String(r[idxTag] ?? '').trim() : '';
      const comment = idxComment >= 0 ? String(r[idxComment] ?? '').trim() : '';
      const note = [tag, comment].filter(Boolean).join(' - ');

      parsed.push({
        kind,
        amountCents: Math.abs(cents),
        occurredOn: dateISO,
        categoryName: catName,
        accountName: accName,
        note,
      });
    }
  };

  parseFlowSheet(expSheetName, 'expense');
  parseFlowSheet(incSheetName, 'income');

  if (trfSheetName) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[trfSheetName], {
      header: 1,
      raw: true,
      defval: '',
    });
    const hIdx = rows.findIndex(
      (r) =>
        Array.isArray(r) &&
        r.some((c) => /data e ora|^data$/i.test(String(c).trim()))
    );
    if (hIdx !== -1) {
      const hdr = rows[hIdx].map((c) => String(c ?? '').trim().toLowerCase());
      const idxDate = hdr.findIndex((h) => /data/.test(h));
      const idxFrom = hdr.findIndex((h) => /uscita/.test(h));
      const idxTo = hdr.findIndex((h) => /entrata/.test(h));
      const idxAmt = hdr.findIndex((h) => /importo nella valuta in uscita|^importo/.test(h));
      const idxComment = hdr.findIndex((h) => /comment|not[ae]/.test(h));

      for (let i = hIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!Array.isArray(r)) continue;
        const dateISO = parseFlexibleExcelDate(r[idxDate >= 0 ? idxDate : 0]);
        if (!dateISO) continue;
        const cents = parseEuroToCents(
          r[idxAmt >= 0 ? idxAmt : 3] as string | number
        );
        if (!cents || Math.abs(cents) === 0) continue;

        parsed.push({
          kind: 'transfer',
          amountCents: Math.abs(cents),
          occurredOn: dateISO,
          accountName: String(r[idxFrom >= 0 ? idxFrom : 1] ?? '').trim() || 'Principale',
          toAccountName:
            String(r[idxTo >= 0 ? idxTo : 2] ?? '').trim() || 'Conto Secondario',
          note: idxComment >= 0 ? String(r[idxComment] ?? '').trim() : '',
        });
      }
    }
  }

  return parsed;
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
  const [innimAutoRows, setInnimAutoRows] = useState<ImportedTransactionRow[] | null>(
    null
  );
  const [deduplicate, setDeduplicate] = useState<boolean>(true);

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

    // Detect real header row (skipping optional title/banner rows at top)
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: true,
      defval: '',
    });

    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(10, matrix.length); i++) {
      const row = matrix[i];
      if (!Array.isArray(row)) continue;
      const nonEmpty = row.filter((c) => String(c ?? '').trim() !== '');
      const hasHeaderKeyword = nonEmpty.some((c) =>
        /data|date|importo|spes|entrat|categori|conto|amount/i.test(String(c))
      );
      if (nonEmpty.length >= 2 && hasHeaderKeyword) {
        headerRowIndex = i;
        break;
      }
    }

    const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: true,
      range: headerRowIndex,
    });
    setRawRows(jsonRows);

    const allCols =
      jsonRows.length > 0
        ? Object.keys(jsonRows[0]).filter((k) => !k.startsWith('__EMPTY'))
        : [];
    const usableCols =
      allCols.length > 0
        ? allCols
        : jsonRows.length > 0
        ? Object.keys(jsonRows[0])
        : [];
    setHeaders(usableCols);

    const findCol = (patterns: RegExp[]) =>
      usableCols.find((h) => patterns.some((p) => p.test(h.toLowerCase()))) || '';

    const detectedDate = findCol([/data/, /date/, /giorno/]);
    const detectedExp = findCol([/^spes/, /^uscit/, /addebito/, /dare/, /expense/]);
    const detectedInc = findCol([/^entrat/, /accredito/, /avere/, /income/]);
    const detectedAmt = findCol([
      /importo in valuta del conto/,
      /importo/,
      /ammontare/,
      /valore/,
      /euro/,
      /amount/,
      /totale/,
    ]);
    const detectedKind = findCol([/tipo/, /movimento/, /type/, /flusso/]);
    const detectedCat = findCol([/^categori/, /voce/, /category/]);
    const detectedSub = findCol([/sottocateg/, /subcat/, /^tag$/, /dettaglio/]);
    const detectedNote = findCol([/comment/, /not[ae]/, /descrizion/, /causale/]);
    const detectedAcc = findCol([/^conto$/, /portafogli/, /account/]);

    setColDate(detectedDate || usableCols[0] || '');
    if (detectedExp && detectedInc && !detectedAmt) {
      setAmountMode('separate');
      setColExpense(detectedExp);
      setColIncome(detectedInc);
    } else {
      setAmountMode('single');
      setColAmount(detectedAmt || detectedExp || usableCols[1] || '');
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
      // cellDates: false prevents CET/CEST DST shifts; parse_date_code extracts exact Y-M-D
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);

      // Try native "Budget e finanze.xlsx" (Spese + Entrate + Bonifici) multi-sheet auto-detection
      const autoDetected = tryParseBudgetEFinanzeWorkbook(wb);
      if (autoDetected && autoDetected.length > 0) {
        setInnimAutoRows(autoDetected);
      } else {
        setInnimAutoRows(null);
      }

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
    e.target.value = '';
  };

  const manualParsedPreview = useMemo<ImportedTransactionRow[]>(() => {
    if (rawRows.length === 0 || !colDate) return [];
    const results: ImportedTransactionRow[] = [];
    const sheetLower = selectedSheet.trim().toLowerCase();

    for (const row of rawRows) {
      const dateISO = parseFlexibleExcelDate(row[colDate]);
      if (!dateISO) continue;

      let kind: TransactionKind = 'expense';
      let amountCents = 0;

      if (amountMode === 'separate') {
        const expVal = colExpense
          ? parseEuroToCents(row[colExpense] as string | number)
          : null;
        const incVal = colIncome
          ? parseEuroToCents(row[colIncome] as string | number)
          : null;
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
        if (/trasf|girocont|bonific|transfer/.test(kindRaw)) {
          kind = 'transfer';
        } else if (/entrat|accredit|stipendi|income|\+/.test(kindRaw)) {
          kind = 'income';
        } else if (/spes|uscit|addebit|expense|-/.test(kindRaw)) {
          kind = 'expense';
        } else if (/entrat|income/.test(sheetLower)) {
          kind = 'income';
        } else if (/spes|uscit|expense/.test(sheetLower)) {
          kind = 'expense';
        } else {
          if (rawAmt < 0) kind = 'expense';
          else if (colKind) kind = 'expense';
          else {
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
    selectedSheet,
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

  const activeImportRows = innimAutoRows ?? manualParsedPreview;

  const innimStats = useMemo(() => {
    if (!innimAutoRows) return null;
    let expCount = 0;
    let expCents = 0;
    let incCount = 0;
    let incCents = 0;
    let trfCount = 0;
    for (const r of innimAutoRows) {
      if (r.kind === 'expense') {
        expCount++;
        expCents += r.amountCents;
      } else if (r.kind === 'income') {
        incCount++;
        incCents += r.amountCents;
      } else {
        trfCount++;
      }
    }
    return { expCount, expCents, incCount, incCents, trfCount };
  }, [innimAutoRows]);

  const handleConfirmImport = async () => {
    if (activeImportRows.length === 0) return;
    setImporting(true);
    try {
      const res = await importTransactionsBatch(activeImportRows, { deduplicate });
      const skippedText =
        res.skipped > 0 ? ` (${res.skipped} duplicati già presenti ignorati)` : '';
      setStatusMsg({
        type: 'success',
        text: `Importate ${res.imported} operazioni${skippedText}! Conti e categorie allineati automaticamente.`,
      });
      setWorkbook(null);
      setInnimAutoRows(null);
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

  // Export helpers
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // Exact 3-sheet "Budget e finanze.xlsx" format (Spese, Entrate, Bonifici) for Google Drive / Sheets continuity
  const handleExportBudgetEFinanzeFormat = async () => {
    const wb = XLSX.utils.book_new();
    const year = todayISO().slice(0, 4);

    const buildFlowAoA = (kind: 'expense' | 'income', label: string) => {
      const aoa: (string | number)[][] = [
        [
          `elenco ${label} per il periodo 1 gennaio ${year} – 31 dicembre ${year}`,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ],
        [
          'Data e ora',
          'Categoria',
          'Conto',
          'Importo in valuta del conto',
          'Valuta conto',
          'Importo in valuta della transazione',
          'Valuta transazione',
          'Tag',
          'Commento',
        ],
      ];

      for (const tx of transactions) {
        if (tx.kind !== kind) continue;
        const cat = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
        const sub = tx.subcategoryId ? categoryMap.get(tx.subcategoryId) : undefined;
        const acc = accountMap.get(tx.accountId);
        aoa.push([
          tx.occurredOn,
          cat?.name ?? 'Altro',
          acc?.name ?? 'Principale',
          Number((tx.amountCents / 100).toFixed(2)),
          'EUR',
          '',
          '',
          sub?.name ?? '',
          tx.note ?? '',
        ]);
      }
      return XLSX.utils.aoa_to_sheet(aoa);
    };

    const buildTransfersAoA = () => {
      const aoa: (string | number)[][] = [
        [
          `elenco bonifici per il periodo 1 gennaio ${year} – 31 dicembre ${year}`,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ],
        [
          'Data e ora',
          'In uscita',
          'In entrata',
          'Importo nella valuta in uscita',
          'Valuta in uscita',
          'Importo nella valuta in entrata',
          'Valuta in entrata',
          'Commento',
        ],
      ];
      for (const tx of transactions) {
        if (tx.kind !== 'transfer') continue;
        const fromAcc = accountMap.get(tx.accountId);
        const toAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;
        const eur = Number((tx.amountCents / 100).toFixed(2));
        aoa.push([
          tx.occurredOn,
          fromAcc?.name ?? 'Principale',
          toAcc?.name ?? 'Conto Secondario',
          eur,
          'EUR',
          eur,
          'EUR',
          tx.note ?? '',
        ]);
      }
      return XLSX.utils.aoa_to_sheet(aoa);
    };

    XLSX.utils.book_append_sheet(wb, buildFlowAoA('expense', 'spese'), 'Spese');
    XLSX.utils.book_append_sheet(wb, buildFlowAoA('income', 'entrate'), 'Entrate');
    XLSX.utils.book_append_sheet(wb, buildTransfersAoA(), 'Bonifici');

    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    await exportOrDownloadFile(
      'Budget e finanze.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      new Uint8Array(out)
    );
  };

  const buildUnifiedExportRows = () =>
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
            ? -Number((tx.amountCents / 100).toFixed(2))
            : Number((tx.amountCents / 100).toFixed(2)),
        Categoria: cat?.name ?? '',
        Sottocategoria: sub?.name ?? '',
        Conto: fromAcc?.name ?? '',
        'Conto Destinazione': toAcc?.name ?? '',
        Commento: tx.note,
      };
    });

  const handleExportUnifiedExcel = async () => {
    const rows = buildUnifiedExportRows();
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
    const rows = buildUnifiedExportRows();
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
    e.target.value = '';
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
              Importa da &ldquo;Budget e finanze.xlsx&rdquo; o CSV
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Riconosce in automatico i 3 fogli (<strong>Spese, Entrate, Bonifici</strong>) del tuo file Excel 2026 o qualsiasi tabella personalizzata.
            </p>
          </div>
        </div>

        <label className="block w-full cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 p-4 text-center transition">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Tocca per scegliere &ldquo;Budget e finanze.xlsx&rdquo; o un file .csv
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Native Multi-Sheet "Budget e finanze.xlsx" Auto-Detection Card */}
        {workbook && innimAutoRows && innimStats && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  Formato &ldquo;Budget e finanze&rdquo; rilevato!
                </span>
                <button
                  type="button"
                  onClick={() => setInnimAutoRows(null)}
                  className="text-[11px] font-semibold underline text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  Mappa manuale
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="rounded-xl bg-white/80 dark:bg-slate-900/70 p-2.5">
                  <p className="text-[11px] text-slate-400">Foglio Spese</p>
                  <p className="font-bold text-rose-500 tabular-nums">
                    {innimStats.expCount} voci · -{formatEuro(innimStats.expCents)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 dark:bg-slate-900/70 p-2.5">
                  <p className="text-[11px] text-slate-400">Foglio Entrate</p>
                  <p className="font-bold text-emerald-500 tabular-nums">
                    {innimStats.incCount} voci · +{formatEuro(innimStats.incCents)}
                  </p>
                </div>
              </div>
              {innimStats.trfCount > 0 && (
                <p className="text-[11px] text-slate-500">
                  + {innimStats.trfCount} trasferimenti dal foglio Bonifici
                </p>
              )}
            </div>

            <label className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Salta operazioni già presenti (anti-duplicati)
              </span>
              <input
                type="checkbox"
                checked={deduplicate}
                onChange={(e) => setDeduplicate(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>

            <button
              type="button"
              disabled={importing}
              onClick={handleConfirmImport}
              className="w-full py-3 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-xs disabled:opacity-40"
            >
              {importing
                ? 'Importazione in corso...'
                : `Importa tutte le ${innimAutoRows.length} operazioni`}
            </button>
          </div>
        )}

        {/* Generic Column Mapping & Live Preview */}
        {workbook && !innimAutoRows && headers.length > 0 && (
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
                    <option value="">Auto da foglio / segno</option>
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
                  Commento / Nota (opz.)
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

            <label className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Salta operazioni già presenti (anti-duplicati)
              </span>
              <input
                type="checkbox"
                checked={deduplicate}
                onChange={(e) => setDeduplicate(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>

            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Righe valide pronte da importare: {manualParsedPreview.length}
              </p>
              {manualParsedPreview.slice(0, 4).map((p, idx) => (
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
              disabled={manualParsedPreview.length === 0 || importing}
              onClick={handleConfirmImport}
              className="w-full py-3 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-xs disabled:opacity-40"
            >
              {importing
                ? 'Importazione in corso...'
                : `Importa ${manualParsedPreview.length} operazioni`}
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
              Esporta nello stesso identico formato 3 fogli del tuo file Google Drive o in tabella unica.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportBudgetEFinanzeFormat}
          className="w-full py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
        >
          <Download className="w-4 h-4" />
          Esporta &ldquo;Budget e finanze.xlsx&rdquo; (Spese / Entrate / Bonifici)
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleExportUnifiedExcel}
            className="py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            Tabella Unica .xlsx
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <Download className="w-4 h-4 text-sky-500" />
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
