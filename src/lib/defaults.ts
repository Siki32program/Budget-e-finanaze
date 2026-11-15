import type { Account, Category } from '../types/finance';

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

export function createInitialSeedData(): {
  accounts: Account[];
  categories: Category[];
} {
  const now = new Date().toISOString();

  // Single default account as requested by user ("Per ora uso un solo conto")
  const mainAccount: Account = {
    id: generateUUID(),
    name: 'Conto Principale',
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

  // Expense categories & subcategories
  addCat('expense', 'Alimentari & Spesa', 'shopping-cart', '#3b82f6', [
    'Supermercato',
    'Mercato & Forno',
  ]);
  addCat('expense', 'Ristoranti & Bar', 'utensils', '#f59e0b', [
    'Ristorante / Pizzeria',
    'Bar & Colazione',
    'Delivery & Asporto',
  ]);
  addCat('expense', 'Casa & Utenze', 'home', '#10b981', [
    'Affitto / Mutuo',
    'Luce & Gas',
    'Internet & Telefono',
    'Manutenzione Casa',
  ]);
  addCat('expense', 'Trasporti & Auto', 'car', '#06b6d4', [
    'Carburante',
    'Mezzi Pubblici',
    'Parcheggi & Pedaggi',
    'Assicurazione & Bollo',
  ]);
  addCat('expense', 'Shopping', 'shopping-bag', '#8b5cf6', [
    'Abbigliamento',
    'Elettronica',
    'Regali',
  ]);
  addCat('expense', 'Salute & Cura', 'heart-pulse', '#ef4444', [
    'Farmacia & Visite',
    'Palestra & Sport',
    'Cura Persona',
  ]);
  addCat('expense', 'Svago & Abbonamenti', 'film', '#ec4899', [
    'Abbonamenti Digitali',
    'Uscite & Eventi',
    'Viaggi & Vacanze',
    'Hobby',
  ]);
  addCat('expense', 'Altre Spese', 'other', '#64748b', []);

  // Income categories
  sortIdx = 0;
  addCat('income', 'Stipendio', 'briefcase', '#10b981', []);
  addCat('income', 'Entrate Extra', 'coins', '#3b82f6', []);
  addCat('income', 'Rimborsi', 'receipt', '#06b6d4', []);
  addCat('income', 'Regali & Altro', 'gift', '#f59e0b', []);

  return {
    accounts: [mainAccount],
    categories,
  };
}
