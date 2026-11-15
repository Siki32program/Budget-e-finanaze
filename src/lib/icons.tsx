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
  Heart,
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
  Target,
  Trophy,
  Dices,
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
  heart: Heart,
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
  target: Target,
  trophy: Trophy,
  dices: Dices,
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
      { id: 'shopping-cart', label: 'Alimentari' },
      { id: 'utensils', label: 'Ristorante' },
      { id: 'coffee', label: 'Bar / Macchinetta' },
      { id: 'pizza', label: 'Pizza / Cibo' },
    ],
  },
  {
    label: 'Trasporti & Viaggi',
    icons: [
      { id: 'bus', label: 'Mezzi pubblici' },
      { id: 'car', label: 'Auto' },
      { id: 'fuel', label: 'Carburante' },
      { id: 'plane', label: 'Viaggi / Souvenir' },
    ],
  },
  {
    label: 'Svago, Bet, Vinted & Regali',
    icons: [
      { id: 'gamepad', label: 'Svago' },
      { id: 'film', label: 'Cinema / TV' },
      { id: 'trophy', label: 'Bet / Sport' },
      { id: 'dices', label: 'Gioco' },
      { id: 'target', label: 'Matched Betting' },
      { id: 'shirt', label: 'Vinted / Abiti' },
      { id: 'shopping-bag', label: 'Shopping' },
      { id: 'gift', label: 'Regali' },
      { id: 'heart', label: 'Famiglia / Nonna' },
      { id: 'graduation', label: 'Istruzione' },
      { id: 'music', label: 'Musica' },
      { id: 'book', label: 'Libri' },
      { id: 'smartphone', label: 'Tech' },
    ],
  },
  {
    label: 'Casa, Salute & Cura',
    icons: [
      { id: 'home', label: 'Casa' },
      { id: 'zap', label: 'Luce & Gas' },
      { id: 'wifi', label: 'Internet' },
      { id: 'wrench', label: 'Manutenzione' },
      { id: 'heart-pulse', label: 'Salute' },
      { id: 'stethoscope', label: 'Visite' },
      { id: 'dumbbell', label: 'Palestra' },
      { id: 'sparkles', label: 'Cura persona' },
      { id: 'paw', label: 'Animali' },
      { id: 'baby', label: 'Bambini' },
    ],
  },
  {
    label: 'Lavoro, Conti & Entrate',
    icons: [
      { id: 'briefcase', label: 'Stipendio' },
      { id: 'trending-up', label: 'Matched / Rendite' },
      { id: 'coins', label: 'Extra / Bottiglie' },
      { id: 'receipt', label: 'Rimborsi' },
      { id: 'landmark', label: 'Banca / Interessi' },
      { id: 'banknote', label: 'Contanti' },
      { id: 'credit-card', label: 'Carta' },
      { id: 'wallet', label: 'Portafoglio' },
      { id: 'piggy-bank', label: 'Risparmi' },
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
