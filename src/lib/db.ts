import Dexie, { type Table } from 'dexie';
import type {
  Account,
  AppSettings,
  Category,
  OutboxItem,
  RecurringRule,
  Transaction,
} from '../types/finance';

export class SikiBudgetDB extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  recurringRules!: Table<RecurringRule, string>;
  outbox!: Table<OutboxItem, string>;

  constructor() {
    super('siki_budget_db_v1');
    this.version(1).stores({
      accounts: 'id, sortOrder, archived, deletedAt, updatedAt',
      categories: 'id, parentId, kind, sortOrder, archived, deletedAt, updatedAt',
      transactions: 'id, kind, accountId, toAccountId, categoryId, subcategoryId, occurredOn, deletedAt, updatedAt',
      recurringRules: 'id, kind, nextDueOn, active, deletedAt, updatedAt',
      outbox: 'id, table, recordId, updatedAt',
    });
  }
}

export const db = new SikiBudgetDB();

const SETTINGS_STORAGE_KEY = 'siki_budget_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  groupSmallCategories: false,
  defaultPeriod: 'month',
  pinCodeHash: null,
  pinLockOnBackground: true,
  seededVersion: 0,
  hasUserModifiedData: false,
  lastSyncedAt: null,
};

export function loadLocalSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveLocalSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export async function queueOutbox(
  table: OutboxItem['table'],
  recordId: string,
  updatedAt: string
): Promise<void> {
  await db.outbox.put({
    id: `${table}:${recordId}`,
    table,
    recordId,
    updatedAt,
  });
}
