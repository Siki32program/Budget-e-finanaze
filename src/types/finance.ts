export type TransactionKind = 'expense' | 'income' | 'transfer';
export type CategoryKind = 'expense' | 'income';
export type MainFlowTab = 'expense' | 'income';
export type PeriodMode = 'day' | 'week' | 'month' | 'year' | 'custom';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type AccountType = 'bank' | 'cash' | 'card' | 'savings' | 'investment' | 'other';

export type AppView =
  | 'home'
  | 'operations'
  | 'accounts'
  | 'categories'
  | 'recurring'
  | 'stats'
  | 'import_export'
  | 'settings';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  icon: string;
  color: string;
  initialBalanceCents: number;
  includeInTotal: boolean;
  isDefault: boolean;
  archived: boolean;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  parentId: string | null;
  kind: CategoryKind;
  name: string;
  icon: string;
  color: string;
  monthlyBudgetCents: number | null;
  archived: boolean;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  kind: TransactionKind;
  amountCents: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  occurredOn: string; // YYYY-MM-DD
  note: string;
  recurringRuleId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: string;
  title: string;
  kind: TransactionKind;
  amountCents: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  frequency: RecurringFrequency;
  nextDueOn: string; // YYYY-MM-DD
  autoApply: boolean;
  active: boolean;
  note: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutboxItem {
  id: string; // `${table}:${recordId}`
  table: 'accounts' | 'categories' | 'transactions' | 'recurring_rules' | 'user_settings';
  recordId: string;
  updatedAt: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  groupSmallCategories: boolean;
  defaultPeriod: PeriodMode;
  pinCodeHash: string | null;
  pinLockOnBackground: boolean;
  seededVersion: number;
  hasUserModifiedData: boolean;
  lastSyncedAt: string | null;
}

export interface PeriodSelection {
  mode: PeriodMode;
  anchorDate: string; // YYYY-MM-DD
  customStart: string; // YYYY-MM-DD
  customEnd: string; // YYYY-MM-DD
}
