import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  Edit3,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  centsToInputString,
  formatEuro,
  formatShortDate,
  parseEuroToCents,
  todayISO,
} from '../lib/format';
import { DynamicIcon } from '../lib/icons';
import type {
  RecurringFrequency,
  RecurringRule,
  TransactionKind,
} from '../types/finance';

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  daily: 'Ogni giorno',
  weekly: 'Ogni settimana',
  monthly: 'Ogni mese',
  yearly: 'Ogni anno',
};

export function RecurringView() {
  const {
    recurringRules,
    activeAccounts,
    categories,
    saveRecurringRule,
    applyRecurringRuleNow,
    deleteRecurringRule,
  } = useFinance();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [nextDueOn, setNextDueOn] = useState(todayISO());
  const [autoApply, setAutoApply] = useState(true);
  const [note, setNote] = useState('');

  const parentCategories = useMemo(
    () =>
      categories.filter(
        (c) =>
          !c.parentId &&
          !c.archived &&
          c.kind === (kind === 'income' ? 'income' : 'expense')
      ),
    [categories, kind]
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const openCreate = () => {
    const defAcc =
      activeAccounts.find((a) => a.isDefault)?.id || activeAccounts[0]?.id || '';
    const expCats = categories.filter(
      (c) => !c.parentId && !c.archived && c.kind === 'expense'
    );
    setEditing(null);
    setTitle('');
    setKind('expense');
    setAmountStr('');
    setAccountId(defAcc);
    setToAccountId(activeAccounts.find((a) => a.id !== defAcc)?.id || '');
    setCategoryId(expCats[0]?.id || '');
    setFrequency('monthly');
    setNextDueOn(todayISO());
    setAutoApply(true);
    setNote('');
    setModalOpen(true);
  };

  const openEdit = (rule: RecurringRule) => {
    setEditing(rule);
    setTitle(rule.title);
    setKind(rule.kind);
    setAmountStr(centsToInputString(rule.amountCents));
    setAccountId(rule.accountId);
    setToAccountId(rule.toAccountId || '');
    setCategoryId(rule.categoryId || '');
    setFrequency(rule.frequency);
    setNextDueOn(rule.nextDueOn);
    setAutoApply(rule.autoApply);
    setNote(rule.note);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const cents = parseEuroToCents(amountStr);
    if (!cents || cents <= 0 || !accountId) return;

    await saveRecurringRule({
      id: editing?.id,
      title: title.trim() || 'Pagamento regolare',
      kind,
      amountCents: cents,
      accountId,
      toAccountId: kind === 'transfer' ? toAccountId || null : null,
      categoryId: kind === 'transfer' ? null : categoryId || parentCategories[0]?.id || null,
      subcategoryId: null,
      frequency,
      nextDueOn,
      autoApply,
      active: editing?.active ?? true,
      note,
    });
    setModalOpen(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Pagamenti & Entrate Regolari
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Automatizza stipendio, affitto, bollette o abbonamenti fissi.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-3.5 py-2.5 rounded-2xl bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuovo
        </button>
      </div>

      {recurringRules.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200/80 dark:border-slate-800 space-y-2">
          <CalendarClock className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Nessun pagamento regolare configurato
          </p>
          <p className="text-xs text-slate-400">
            Aggiungi ad esempio lo Stipendio mensile o abbonamenti come Netflix, Spotify o Affitto.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {recurringRules.map((rule) => {
            const cat = rule.categoryId ? categoryMap.get(rule.categoryId) : undefined;
            return (
              <div
                key={rule.id}
                className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: cat?.color ?? '#10b981' }}
                    >
                      <DynamicIcon name={cat?.icon ?? 'receipt'} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {rule.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {FREQ_LABELS[rule.frequency]} · Prossima:{' '}
                        <strong className="text-slate-600 dark:text-slate-300">
                          {formatShortDate(rule.nextDueOn)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-extrabold tabular-nums ${
                        rule.kind === 'income'
                          ? 'text-emerald-500'
                          : rule.kind === 'transfer'
                          ? 'text-sky-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {rule.kind === 'income' ? '+' : rule.kind === 'expense' ? '-' : ''}
                      {formatEuro(rule.amountCents)}
                    </p>
                    <span className="text-[10px] font-semibold uppercase text-slate-400">
                      {rule.autoApply ? 'Automatico' : 'Con conferma'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => applyRecurringRuleNow(rule.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Registra ora
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(rule)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Modifica
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing ? 'Modifica Ricorrenza' : 'Nuova Operazione Regolare'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1">
              {(['expense', 'income', 'transfer'] as TransactionKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`py-1.5 rounded-xl text-xs font-bold transition ${
                    kind === k
                      ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950'
                      : 'text-slate-500'
                  }`}
                >
                  {k === 'expense' ? 'Spesa' : k === 'income' ? 'Entrata' : 'Trasf.'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Titolo (es. Stipendio, Affitto, Netflix)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nome operazione ricorrente..."
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Importo (€)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Frequenza
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                >
                  {Object.entries(FREQ_LABELS).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {kind !== 'transfer' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Categoria
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                  >
                    {parentCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Prossima data
                </label>
                <input
                  type="date"
                  value={nextDueOn}
                  onChange={(e) => setNextDueOn(e.target.value || todayISO())}
                  className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 cursor-pointer">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Inserimento automatico alla scadenza
                </p>
                <p className="text-[11px] text-slate-400">
                  Se disattivato, riceverai un promemoria in Home da confermare con 1 tap
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoApply}
                onChange={(e) => setAutoApply(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
            </label>

            <div className="flex gap-2 pt-2">
              {editing && (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteRecurringRule(editing.id);
                    setModalOpen(false);
                  }}
                  className="px-3.5 py-3 rounded-2xl bg-rose-500/15 text-rose-500 text-xs font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-3 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Salva Regola
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
