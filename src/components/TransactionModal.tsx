import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Calculator,
  Calendar,
  Check,
  Delete,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  addDaysISO,
  centsToInputString,
  evaluateCalculatorExpression,
  formatEuro,
  todayISO,
} from '../lib/format';
import { COLOR_PALETTE, DynamicIcon } from '../lib/icons';
import type { Transaction, TransactionKind } from '../types/finance';

interface TransactionModalProps {
  open: boolean;
  editingTransaction: Transaction | null;
  preset?: {
    kind?: TransactionKind;
    categoryId?: string;
  } | null;
  onClose: () => void;
}

export function TransactionModal({
  open,
  editingTransaction,
  preset,
  onClose,
}: TransactionModalProps) {
  const {
    activeAccounts,
    categories,
    selectedAccountFilter,
    saveTransaction,
    deleteTransaction,
    saveAccount,
    saveCategory,
  } = useFinance();

  const defaultAccId = useMemo(() => {
    if (
      selectedAccountFilter !== 'all' &&
      activeAccounts.some((a) => a.id === selectedAccountFilter)
    ) {
      return selectedAccountFilter;
    }
    return (
      activeAccounts.find((a) => a.isDefault)?.id ||
      activeAccounts[0]?.id ||
      ''
    );
  }, [activeAccounts, selectedAccountFilter]);

  const [kind, setKind] = useState<TransactionKind>('expense');
  const [expr, setExpr] = useState<string>('');
  const [showCalcPad, setShowCalcPad] = useState<boolean>(true);
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [occurredOn, setOccurredOn] = useState<string>(todayISO());
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick inline creators so user never gets stuck mid-entry
  const [quickAccountName, setQuickAccountName] = useState('');
  const [showQuickAccount, setShowQuickAccount] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [showQuickCat, setShowQuickCat] = useState(false);

  const parentCategories = useMemo(
    () =>
      categories.filter(
        (c) =>
          !c.archived &&
          !c.parentId &&
          c.kind === (kind === 'income' ? 'income' : 'expense')
      ),
    [categories, kind]
  );

  const subcategories = useMemo(
    () =>
      categoryId
        ? categories.filter((c) => !c.archived && c.parentId === categoryId)
        : [],
    [categories, categoryId]
  );

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setShowQuickAccount(false);
    setShowQuickCat(false);

    if (editingTransaction) {
      setKind(editingTransaction.kind);
      setExpr(centsToInputString(editingTransaction.amountCents));
      setAccountId(editingTransaction.accountId || defaultAccId);
      setToAccountId(
        editingTransaction.toAccountId ||
          activeAccounts.find((a) => a.id !== editingTransaction.accountId)?.id ||
          ''
      );
      setCategoryId(editingTransaction.categoryId);
      setSubcategoryId(editingTransaction.subcategoryId);
      setOccurredOn(editingTransaction.occurredOn);
      setNote(editingTransaction.note);
      setShowCalcPad(false);
    } else {
      const initialKind = preset?.kind ?? 'expense';
      setKind(initialKind);
      setExpr('');
      setAccountId(defaultAccId);
      const secondAcc = activeAccounts.find((a) => a.id !== defaultAccId)?.id || '';
      setToAccountId(secondAcc);
      setOccurredOn(todayISO());
      setNote('');
      setShowCalcPad(true);

      if (initialKind !== 'transfer') {
        const availableParents = categories.filter(
          (c) => !c.archived && !c.parentId && c.kind === initialKind
        );
        const chosenCat =
          preset?.categoryId &&
          availableParents.some((c) => c.id === preset.categoryId)
            ? preset.categoryId
            : availableParents[0]?.id ?? null;
        setCategoryId(chosenCat);
        setSubcategoryId(null);
      } else {
        setCategoryId(null);
        setSubcategoryId(null);
      }
    }
  }, [open, editingTransaction, preset, defaultAccId, activeAccounts, categories]);

  // Ensure category belongs to active kind when switching Spesa <-> Entrata
  useEffect(() => {
    if (!open || kind === 'transfer') return;
    const valid = parentCategories.some((c) => c.id === categoryId);
    if (!valid) {
      setCategoryId(parentCategories[0]?.id ?? null);
      setSubcategoryId(null);
    }
  }, [kind, parentCategories, categoryId, open]);

  const calc = useMemo(() => evaluateCalculatorExpression(expr), [expr]);

  if (!open) return null;

  const appendToken = (token: string) => {
    setErrorMsg(null);
    setExpr((prev) => {
      const operators = ['+', '-', '×', '÷'];
      if (operators.includes(token)) {
        if (!prev) return token === '-' ? '-' : '';
        const last = prev.slice(-1);
        if (operators.includes(last)) {
          return prev.slice(0, -1) + token;
        }
        return prev + token;
      }
      if (token === ',') {
        // Prevent two commas in the current number segment
        const parts = prev.split(/[+\-×÷]/);
        const currentNum = parts[parts.length - 1] ?? '';
        if (currentNum.includes(',') || currentNum.includes('.')) return prev;
        return currentNum === '' ? `${prev}0,` : `${prev},`;
      }
      return prev + token;
    });
  };

  const handleBackspace = () => {
    setExpr((prev) => prev.slice(0, -1));
  };

  const handleEvaluateEquals = () => {
    if (calc.cents > 0) {
      setExpr(centsToInputString(calc.cents));
    }
  };

  const handleCreateQuickAccount = async () => {
    const trimmed = quickAccountName.trim();
    if (!trimmed) return;
    const created = await saveAccount({
      name: trimmed,
      type: 'cash',
      icon: 'wallet',
      color: '#3b82f6',
      initialBalanceCents: 0,
      includeInTotal: true,
      isDefault: false,
    });
    setToAccountId(created.id);
    setQuickAccountName('');
    setShowQuickAccount(false);
  };

  const handleCreateQuickCategory = async () => {
    if (kind === 'transfer') return;
    const trimmed = quickCatName.trim();
    if (!trimmed) return;
    const randomColor =
      COLOR_PALETTE[parentCategories.length % COLOR_PALETTE.length];
    const created = await saveCategory({
      parentId: null,
      kind,
      name: trimmed,
      icon: kind === 'expense' ? 'tag' : 'coins',
      color: randomColor,
      monthlyBudgetCents: null,
    });
    setCategoryId(created.id);
    setSubcategoryId(null);
    setQuickCatName('');
    setShowQuickCat(false);
  };

  const handleSubmit = async () => {
    if (!calc.valid || calc.cents <= 0) {
      setErrorMsg('Inserisci un importo maggiore di 0,00 €.');
      setShowCalcPad(true);
      return;
    }
    if (!accountId) {
      setErrorMsg('Seleziona un conto.');
      return;
    }
    if (kind === 'transfer') {
      if (!toAccountId) {
        setErrorMsg('Seleziona o crea il conto di destinazione per il trasferimento.');
        return;
      }
      if (accountId === toAccountId) {
        setErrorMsg('Il conto di partenza e quello di destinazione devono essere diversi.');
        return;
      }
    } else if (!categoryId) {
      setErrorMsg('Seleziona una categoria.');
      return;
    }

    setSaving(true);
    try {
      await saveTransaction({
        id: editingTransaction?.id,
        kind,
        amountCents: calc.cents,
        accountId,
        toAccountId: kind === 'transfer' ? toAccountId : null,
        categoryId: kind === 'transfer' ? null : categoryId,
        subcategoryId: kind === 'transfer' ? null : subcategoryId,
        occurredOn,
        note,
      });
      onClose();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    await deleteTransaction(editingTransaction.id);
    onClose();
  };

  const today = todayISO();
  const yesterday = addDaysISO(today, -1);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[94vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header + 3 Instant Tabs: Spesa | Entrata | Trasferimento */}
        <div className="bg-emerald-900 dark:bg-slate-950 text-white px-4 pt-3.5 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold tracking-tight">
              {editingTransaction ? 'Modifica operazione' : 'Nuova operazione'}
            </h2>
            <div className="flex items-center gap-1">
              {editingTransaction && (
                <button
                  type="button"
                  onClick={handleDelete}
                  title="Elimina operazione"
                  className="p-2 rounded-xl text-rose-300 hover:bg-rose-500/20 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 bg-black/25 dark:bg-slate-900 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setKind('expense')}
              className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition ${
                kind === 'expense'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Spesa
            </button>
            <button
              type="button"
              onClick={() => setKind('income')}
              className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition ${
                kind === 'income'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Entrata
            </button>
            <button
              type="button"
              onClick={() => setKind('transfer')}
              className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition flex items-center justify-center gap-1 ${
                kind === 'transfer'
                  ? 'bg-sky-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Trasferim.
            </button>
          </div>
        </div>

        {/* Amount & Live Calculator Display */}
        <div
          onClick={() => setShowCalcPad(true)}
          className="px-5 py-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Calculator className="w-3.5 h-3.5 text-emerald-500" />
              <span>Importo (calcolatrice attiva)</span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5 overflow-x-auto no-scrollbar">
              <span
                className={`text-3xl font-extrabold tabular-nums tracking-tight ${
                  !expr
                    ? 'text-slate-300 dark:text-slate-600'
                    : kind === 'expense'
                    ? 'text-rose-600 dark:text-rose-400'
                    : kind === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-sky-600 dark:text-sky-400'
                }`}
              >
                {expr || '0,00'}
              </span>
              <span className="text-xl font-bold text-slate-400">€</span>
            </div>
            {calc.hasOperator && (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                = {formatEuro(calc.cents)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowCalcPad((v) => !v);
            }}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            {showCalcPad ? 'Nascondi tastierino' : 'Tastierino'}
          </button>
        </div>

        {/* Scrollable Body: Account(s), Categories/Subcategories, Date, Note */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {errorMsg && (
            <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Account Selection */}
          {kind === 'transfer' ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Da Conto
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none border border-transparent focus:border-sky-500"
                  >
                    {activeAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (toAccountId) {
                      const prevFrom = accountId;
                      setAccountId(toAccountId);
                      setToAccountId(prevFrom);
                    }
                  }}
                  title="Inverti conti"
                  className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sky-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    A Conto
                  </label>
                  {activeAccounts.length > 1 ? (
                    <select
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none border border-transparent focus:border-sky-500"
                    >
                      <option value="">Seleziona...</option>
                      {activeAccounts
                        .filter((a) => a.id !== accountId)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowQuickAccount(true)}
                      className="w-full rounded-xl bg-sky-500/15 border border-sky-500/40 px-3 py-2.5 text-xs font-bold text-sky-600 dark:text-sky-300 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nuovo conto
                    </button>
                  )}
                </div>
              </div>

              {(activeAccounts.length === 1 || showQuickAccount) && (
                <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 space-y-2">
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    Hai attualmente un solo conto attivo. Crea al volo il secondo conto (es.{' '}
                    <em>Contanti</em> o <em>Carta</em>) per registrare il trasferimento:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={quickAccountName}
                      onChange={(e) => setQuickAccountName(e.target.value)}
                      placeholder="Es. Contanti, Revolut, Risparmi..."
                      className="flex-1 rounded-xl bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateQuickAccount}
                      className="px-3 py-2 rounded-xl bg-sky-500 text-slate-950 text-xs font-bold"
                    >
                      Crea
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            activeAccounts.length > 1 && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Conto
                </label>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                  {activeAccounts.map((acc) => {
                    const selected = accountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setAccountId(acc.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 border transition ${
                          selected
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <DynamicIcon name={acc.icon} className="w-3.5 h-3.5" />
                        {acc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Category & Subcategory Grid (for Expense / Income) */}
          {kind !== 'transfer' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Categoria
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickCat((v) => !v)}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuova
                </button>
              </div>

              {showQuickCat && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickCatName}
                    onChange={(e) => setQuickCatName(e.target.value)}
                    placeholder="Nome nuova categoria..."
                    className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateQuickCategory}
                    className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
                  >
                    Aggiungi
                  </button>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2">
                {parentCategories.map((cat) => {
                  const selected = categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(cat.id);
                        setSubcategoryId(null);
                      }}
                      className={`flex flex-col items-center p-2 rounded-2xl border transition ${
                        selected
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 shadow-2xs'
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition ${
                          selected
                            ? 'text-white scale-105 shadow-xs'
                            : 'text-white opacity-75'
                        }`}
                        style={{ backgroundColor: cat.color }}
                      >
                        <DynamicIcon name={cat.icon} className="w-5 h-5" />
                      </div>
                      <span
                        className={`mt-1 text-[11px] leading-tight text-center line-clamp-1 ${
                          selected
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Subcategories pills if selected parent has subcategories */}
              {subcategories.length > 0 && (
                <div className="pt-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Sottocategoria (opzionale)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {subcategories.map((sub) => {
                      const activeSub = subcategoryId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() =>
                            setSubcategoryId(activeSub ? null : sub.id)
                          }
                          className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition ${
                            activeSub
                              ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-bold'
                              : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date Quick Pills + Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Data
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOccurredOn(today)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
                    occurredOn === today
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Oggi
                </button>
                <button
                  type="button"
                  onClick={() => setOccurredOn(yesterday)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
                    occurredOn === yesterday
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Ieri
                </button>
                <div className="relative flex-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="date"
                    value={occurredOn}
                    onChange={(e) => setOccurredOn(e.target.value || today)}
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 pl-8 pr-2 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Commento / Nota
              </label>
              <input
                type="text"
                value={note}
                onFocus={() => setShowCalcPad(false)}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Es. Spesa Esselunga, Pizza..."
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none border border-transparent focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Integrated Custom Calculator Keypad + Submit Button */}
        <div className="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3 pb-[max(0.75rem,var(--safe-bottom))]">
          {showCalcPad && (
            <div className="grid grid-cols-4 gap-1.5 mb-2.5 select-none">
              {[
                { label: '7', type: 'num' },
                { label: '8', type: 'num' },
                { label: '9', type: 'num' },
                { label: '÷', type: 'op' },
                { label: '4', type: 'num' },
                { label: '5', type: 'num' },
                { label: '6', type: 'num' },
                { label: '×', type: 'op' },
                { label: '1', type: 'num' },
                { label: '2', type: 'num' },
                { label: '3', type: 'num' },
                { label: '-', type: 'op' },
                { label: ',', type: 'num' },
                { label: '0', type: 'num' },
                { label: 'BACK', type: 'back' },
                { label: '+', type: 'op' },
              ].map((btn) => {
                if (btn.type === 'back') {
                  return (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={handleBackspace}
                      className="h-11 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center active:scale-95 transition shadow-2xs"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  );
                }
                const isOp = btn.type === 'op';
                return (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => appendToken(btn.label)}
                    className={`h-11 rounded-xl text-base font-bold flex items-center justify-center active:scale-95 transition shadow-2xs ${
                      isOp
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            {showCalcPad && calc.hasOperator && (
              <button
                type="button"
                onClick={handleEvaluateEquals}
                className="px-4 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-base active:scale-95 transition"
              >
                =
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="flex-1 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              {editingTransaction ? 'Salva modifiche' : 'Aggiungi'}
              {calc.cents > 0 && ` (${formatEuro(calc.cents)})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
