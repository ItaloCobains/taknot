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
};

export const NOTEBOOK_ICON_NAMES = Object.keys(NOTEBOOK_ICON_MAP);

export function NotebookIcon({ name, className = '', ...props }) {
  const Icon = NOTEBOOK_ICON_MAP[name] || Book;
  const key = NOTEBOOK_ICON_MAP[name] ? name : 'Book';
  const merged = ['nb-icon', `nb-icon-${key}`, className].filter(Boolean).join(' ');
  return <Icon className={merged} {...props} />;
}
