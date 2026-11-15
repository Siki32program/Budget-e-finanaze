import type { Account, Category } from '../types/finance';

export const CURRENT_SEED_VERSION = 2;

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Tailored icon & color lookup for known "Budget e finanze" categories
export function inferCategoryAppearance(
  kind: 'expense' | 'income',
  rawName: string
): { icon: string; color: string } {
  const key = rawName.trim().toLowerCase();

  const map: Record<string, { icon: string; color: string }> = {
    alimentari: { icon: 'shopping-cart', color: '#3b82f6' },
    trasporti: { icon: 'bus', color: '#06b6d4' },
    svago: { icon: 'gamepad', color: '#ec4899' },
    bet: { icon: 'trophy', color: '#f59e0b' },
    'matched betting': { icon: 'trending-up', color: '#8b5cf6' },
    regali: { icon: 'gift', color: '#ef4444' },
    regalo: { icon: 'gift', color: '#ef4444' },
    vinted: { icon: 'shirt', color: '#14b8a6' },
    istruzione: { icon: 'graduation', color: '#6366f1' },
    souvenir: { icon: 'plane', color: '#f97316' },
    stipendio: { icon: 'briefcase', color: '#10b981' },
    'xiaomi macchinetta': { icon: 'coffee', color: '#f97316' },
    nonna: { icon: 'heart', color: '#ec4899' },
    rimborsi: { icon: 'receipt', color: '#06b6d4' },
    bottiglie: { icon: 'coins', color: '#84cc16' },
    interessi: { icon: 'landmark', color: '#3b82f6' },
    altro: { icon: 'other', color: '#64748b' },
  };

  if (map[key]) return map[key];
  return {
    icon: kind === 'expense' ? 'tag' : 'coins',
    color: kind === 'expense' ? '#3b82f6' : '#10b981',
  };
}

export function createInitialSeedData(): {
  accounts: Account[];
  categories: Category[];
} {
  const now = new Date().toISOString();

  // Single default account matching "Budget e finanze.xlsx" ("Principale")
  const mainAccount: Account = {
    id: generateUUID(),
    name: 'Principale',
    type: 'bank',
    icon: 'landmark',
    color: '#10b981',
    initialBalanceCents: 0,
    includeInTotal: true,
    isDefault: true,
    archived: false,
    sortOrder: 0,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const categories: Category[] = [];
  let sortIdx = 0;

  const addCat = (
    kind: 'expense' | 'income',
    name: string,
    icon: string,
    color: string,
    subs: string[] = []
  ) => {
    const parentId = generateUUID();
    categories.push({
      id: parentId,
      parentId: null,
      kind,
      name,
      icon,
      color,
      monthlyBudgetCents: null,
      archived: false,
      sortOrder: sortIdx++,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    subs.forEach((subName, idx) => {
      categories.push({
        id: generateUUID(),
        parentId,
        kind,
        name: subName,
        icon,
        color,
        monthlyBudgetCents: null,
        archived: false,
        sortOrder: idx,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });
  };

  // Exact Expense categories from "Budget e finanze.xlsx"
  addCat('expense', 'Alimentari', 'shopping-cart', '#3b82f6');
  addCat('expense', 'Trasporti', 'bus', '#06b6d4');
  addCat('expense', 'Svago', 'gamepad', '#ec4899');
  addCat('expense', 'Bet', 'trophy', '#f59e0b');
  addCat('expense', 'Matched betting', 'trending-up', '#8b5cf6');
  addCat('expense', 'Regali', 'gift', '#ef4444');
  addCat('expense', 'Vinted', 'shirt', '#14b8a6');
  addCat('expense', 'Istruzione', 'graduation', '#6366f1');
  addCat('expense', 'Souvenir', 'plane', '#f97316');
  addCat('expense', 'Altro', 'other', '#64748b');

  // Exact Income categories from "Budget e finanze.xlsx"
  sortIdx = 0;
  addCat('income', 'Stipendio', 'briefcase', '#10b981');
  addCat('income', 'Bet', 'trophy', '#f59e0b');
  addCat('income', 'Xiaomi macchinetta', 'coffee', '#f97316');
  addCat('income', 'Nonna', 'heart', '#ec4899');
  addCat('income', 'Regalo', 'gift', '#ef4444');
  addCat('income', 'Vinted', 'shirt', '#14b8a6');
  addCat('income', 'Matched betting', 'trending-up', '#8b5cf6');
  addCat('income', 'Rimborsi', 'receipt', '#06b6d4');
  addCat('income', 'Bottiglie', 'coins', '#84cc16');
  addCat('income', 'Interessi', 'landmark', '#3b82f6');
  addCat('income', 'Altro', 'other', '#64748b');

  return {
    accounts: [mainAccount],
    categories,
  };
}
