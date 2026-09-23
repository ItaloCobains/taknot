import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  Archive,
  Book,
  Briefcase,
  Camera,
  Code,
  Coffee,
  Folder,
  Heart,
  Home,
  Inbox,
  Lightbulb,
  Music,
  Plane,
  ShoppingBag,
  Star,
  User,
  Wallet,
  Wrench,
} from 'lucide-react';

export const NOTEBOOK_ICON_MAP = {
  Book,
  Inbox,
  Folder,
  Archive,
  Briefcase,
  Code,
  Lightbulb,
  Star,
  Heart,
  Home,
  User,
  Camera,
  Coffee,
  Music,
  Plane,
  ShoppingBag,
  Wallet,
  Wrench,
} as const satisfies Record<string, LucideIcon>;

export type NotebookIconName = keyof typeof NOTEBOOK_ICON_MAP;

export const NOTEBOOK_ICON_NAMES = Object.keys(
  NOTEBOOK_ICON_MAP,
) as NotebookIconName[];

type NotebookIconProps = LucideProps & {
  name?: string | null;
  className?: string;
};

export function NotebookIcon({ name, className = '', ...props }: NotebookIconProps) {
  const key = (name && name in NOTEBOOK_ICON_MAP
    ? name
    : 'Book') as NotebookIconName;
  const Icon = NOTEBOOK_ICON_MAP[key];
  const merged = ['nb-icon', `nb-icon-${key}`, className].filter(Boolean).join(' ');
  return <Icon className={merged} {...props} />;
}
