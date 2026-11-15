import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { centsToInputString, formatEuro, parseEuroToCents } from '../lib/format';
import { COLOR_PALETTE, DynamicIcon, ICON_GROUPS } from '../lib/icons';
import type { Category, CategoryKind } from '../types/finance';

export function CategoriesView() {
  const {
    categories,
    saveCategory,
    deleteCategory,
    moveCategoryOrder,
  } = useFinance();

  const [kindTab, setKindTab] = useState<CategoryKind>('expense');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('shopping-cart');
  const [color, setColor] = useState('#3b82f6');
  const [budgetStr, setBudgetStr] = useState('');

  const parents = useMemo(
    () => categories.filter((c) => c.kind === kindTab && !c.parentId),
    [categories, kindTab]
  );

  const subsByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.kind === kindTab && c.parentId) {
        const list = map.get(c.parentId) ?? [];
        list.push(c);
        map.set(c.parentId, list);
      }
    }
    return map;
  }, [categories, kindTab]);

  const openCreateParent = () => {
    setEditing(null);
    setParentId(null);
    setName('');
    setIcon(kindTab === 'expense' ? 'shopping-bag' : 'coins');
    setColor(COLOR_PALETTE[parents.length % COLOR_PALETTE.length]);
    setBudgetStr('');
    setModalOpen(true);
  };

  const openCreateSub = (parent: Category) => {
    setEditing(null);
    setParentId(parent.id);
    setName('');
    setIcon(parent.icon);
    setColor(parent.color);
    setBudgetStr('');
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setParentId(cat.parentId);
    setName(cat.name);
    setIcon(cat.icon);
    setColor(cat.color);
    setBudgetStr(
      cat.monthlyBudgetCents ? centsToInputString(cat.monthlyBudgetCents) : ''
    );
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const budgetCents =
      !parentId && kindTab === 'expense' && budgetStr.trim()
        ? parseEuroToCents(budgetStr)
        : null;

    await saveCategory({
      id: editing?.id,
      parentId,
      kind: kindTab,
      name: name.trim(),
      icon,
      color,
      monthlyBudgetCents: budgetCents && budgetCents > 0 ? budgetCents : null,
    });
    setModalOpen(false);
  };

  const totalMonthlyBudget = useMemo(
    () =>
      parents.reduce((sum, p) => sum + (p.monthlyBudgetCents ?? 0), 0),
    [parents]
  );

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Spese / Entrate Switch */}
      <div className="grid grid-cols-2 bg-slate-200/70 dark:bg-slate-900 p-1 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setKindTab('expense')}
          className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
            kindTab === 'expense'
              ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Categorie Spese
        </button>
        <button
          type="button"
          onClick={() => setKindTab('income')}
          className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
            kindTab === 'income'
              ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Categorie Entrate
        </button>
      </div>

      {kindTab === 'expense' && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Somma limiti di budget mensili
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Tocca una categoria per impostare un tetto mensile in vista Mese
            </p>
          </div>
          <span className="text-sm font-extrabold tabular-nums text-emerald-700 dark:text-emerald-300">
            {totalMonthlyBudget > 0 ? formatEuro(totalMonthlyBudget) : 'Non impostati'}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {parents.length} categorie principali
        </span>
        <button
          type="button"
          onClick={openCreateParent}
          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          Nuova categoria
        </button>
      </div>

      {/* Category Cards with Subcategories */}
      <div className="space-y-2.5">
        {parents.map((cat, idx) => {
          const subs = subsByParent.get(cat.id) ?? [];
          return (
            <div
              key={cat.id}
              className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full text-white flex items-center justify-center shrink-0"
                    style={{ backgroundColor: cat.color }}
                  >
                    <DynamicIcon name={cat.icon} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {cat.name}
                    </h3>
                    {cat.monthlyBudgetCents ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        Budget mese: {formatEuro(cat.monthlyBudgetCents)}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">
                        {subs.length === 0
                          ? 'Nessuna sottocategoria'
                          : `${subs.length} sottocategorie`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveCategoryOrder(cat.id, -1)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === parents.length - 1}
                    onClick={() => moveCategoryOrder(cat.id, 1)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subcategories pills + Add Subcategory button */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                {subs.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => openEdit(sub)}
                    className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1 transition"
                  >
                    <span>{sub.name}</span>
                    <Edit3 className="w-2.5 h-2.5 opacity-60" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => openCreateSub(cat)}
                  className="px-2.5 py-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-emerald-500 hover:text-emerald-500 flex items-center gap-1 transition"
                >
                  <Plus className="w-3 h-3" />
                  Sottocategoria
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Category Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editing
                  ? parentId
                    ? 'Modifica Sottocategoria'
                    : 'Modifica Categoria'
                  : parentId
                  ? 'Nuova Sottocategoria'
                  : 'Nuova Categoria'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full text-white flex items-center justify-center shrink-0"
                  style={{ backgroundColor: color }}
                >
                  <DynamicIcon name={icon} className="w-6 h-6" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    parentId
                      ? 'Es. Supermercato, Carburante...'
                      : 'Es. Alimentari, Casa...'
                  }
                  className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>

              {!parentId && kindTab === 'expense' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Limite di budget mensile in € (opzionale)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={budgetStr}
                    onChange={(e) => setBudgetStr(e.target.value)}
                    placeholder="Lascia vuoto per nessun limite (es. 300)"
                    className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white outline-none"
                  />
                </div>
              )}

              {!parentId && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      Colore
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setColor(c)}
                          className={`w-7 h-7 rounded-full transition ${
                            color === c
                              ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110'
                              : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-500">
                      Icona (divisa per argomento)
                    </label>
                    {ICON_GROUPS.map((grp) => (
                      <div key={grp.label}>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
                          {grp.label}
                        </p>
                        <div className="grid grid-cols-6 gap-2">
                          {grp.icons.map((ic) => {
                            const selected = icon === ic.id;
                            return (
                              <button
                                key={ic.id}
                                type="button"
                                onClick={() => setIcon(ic.id)}
                                title={ic.label}
                                className={`h-10 rounded-xl flex items-center justify-center transition ${
                                  selected
                                    ? 'text-white shadow-xs scale-105'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                                style={selected ? { backgroundColor: color } : undefined}
                              >
                                <DynamicIcon name={ic.id} className="w-5 h-5" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              {editing && (
                <button
                  type="button"
                  onClick={async () => {
                    await deleteCategory(editing.id);
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
                className="flex-1 py-3 rounded-2xl bg-amber-400 text-slate-950 font-extrabold text-sm"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
