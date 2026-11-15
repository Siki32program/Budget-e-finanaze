import React from 'react';
import {
  ShoppingCart,
  ShoppingBag,
  Utensils,
  Coffee,
  Pizza,
  Home,
  Zap,
  Wifi,
  Car,
  Fuel,
  Bus,
  Plane,
  HeartPulse,
  Dumbbell,
  Stethoscope,
  Sparkles,
  Gamepad2,
  Film,
  Music,
  BookOpen,
  GraduationCap,
  Gift,
  PawPrint,
  Shirt,
  Smartphone,
  Wrench,
  Briefcase,
  Banknote,
  TrendingUp,
  Coins,
  PiggyBank,
  CreditCard,
  Wallet,
  Landmark,
  Receipt,
  ArrowLeftRight,
  HelpCircle,
  Tag,
  Baby,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'shopping-cart': ShoppingCart,
  'shopping-bag': ShoppingBag,
  utensils: Utensils,
  coffee: Coffee,
  pizza: Pizza,
  home: Home,
  zap: Zap,
  wifi: Wifi,
  car: Car,
  fuel: Fuel,
  bus: Bus,
  plane: Plane,
  'heart-pulse': HeartPulse,
  stethoscope: Stethoscope,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  gamepad: Gamepad2,
  film: Film,
  music: Music,
  book: BookOpen,
  graduation: GraduationCap,
  gift: Gift,
  paw: PawPrint,
  shirt: Shirt,
  smartphone: Smartphone,
  wrench: Wrench,
  briefcase: Briefcase,
  banknote: Banknote,
  'trending-up': TrendingUp,
  coins: Coins,
  'piggy-bank': PiggyBank,
  'credit-card': CreditCard,
  wallet: Wallet,
  landmark: Landmark,
  building: Building2,
  receipt: Receipt,
  transfer: ArrowLeftRight,
  shield: ShieldCheck,
  baby: Baby,
  tag: Tag,
  other: HelpCircle,
};

export const ICON_GROUPS: { label: string; icons: { id: string; label: string }[] }[] = [
  {
    label: 'Spesa & Ristorazione',
    icons: [
      { id: 'shopping-cart', label: 'Supermercato' },
      { id: 'utensils', label: 'Ristorante' },
      { id: 'coffee', label: 'Bar / Caffè' },
      { id: 'pizza', label: 'Pizza / Cibo' },
    ],
  },
  {
    label: 'Casa, Utenze & Famiglia',
    icons: [
      { id: 'home', label: 'Casa' },
      { id: 'zap', label: 'Luce & Gas' },
      { id: 'wifi', label: 'Internet' },
      { id: 'wrench', label: 'Manutenzione' },
      { id: 'paw', label: 'Animali' },
      { id: 'baby', label: 'Famiglia' },
    ],
  },
  {
    label: 'Trasporti & Viaggi',
    icons: [
      { id: 'car', label: 'Auto' },
      { id: 'fuel', label: 'Carburante' },
      { id: 'bus', label: 'Mezzi pubblici' },
      { id: 'plane', label: 'Viaggi' },
    ],
  },
  {
    label: 'Shopping, Salute & Svago',
    icons: [
      { id: 'shopping-bag', label: 'Shopping' },
      { id: 'shirt', label: 'Abbigliamento' },
      { id: 'smartphone', label: 'Tech' },
      { id: 'heart-pulse', label: 'Salute' },
      { id: 'stethoscope', label: 'Visite' },
      { id: 'dumbbell', label: 'Sport' },
      { id: 'sparkles', label: 'Cura persona' },
      { id: 'film', label: 'Cinema / TV' },
      { id: 'gamepad', label: 'Svago' },
      { id: 'music', label: 'Musica' },
      { id: 'book', label: 'Libri' },
      { id: 'graduation', label: 'Formazione' },
      { id: 'gift', label: 'Regali' },
    ],
  },
  {
    label: 'Lavoro, Conti & Finanza',
    icons: [
      { id: 'briefcase', label: 'Stipendio' },
      { id: 'banknote', label: 'Contanti' },
      { id: 'landmark', label: 'Banca' },
      { id: 'credit-card', label: 'Carta' },
      { id: 'wallet', label: 'Portafoglio' },
      { id: 'piggy-bank', label: 'Risparmi' },
      { id: 'trending-up', label: 'Investimenti' },
      { id: 'coins', label: 'Extra' },
      { id: 'receipt', label: 'Tasse / Bolli' },
      { id: 'shield', label: 'Assicurazione' },
      { id: 'tag', label: 'Generico' },
      { id: 'other', label: 'Altro' },
    ],
  },
];

export const COLOR_PALETTE = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#64748b', // Slate
];

export function DynamicIcon({
  name,
  className = 'w-5 h-5',
}: {
  name: string;
  className?: string;
}) {
  const IconComp = ICON_MAP[name] || Tag;
  return <IconComp className={className} />;
}
