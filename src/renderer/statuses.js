import {
  CircleCheck,
  CircleMinus,
  CirclePlay,
  CircleX,
} from 'lucide-react';

export const STATUSES = [
  {
    id: 'active',
    label: 'Active',
    className: 'active',
    color: '#61afef',
    Icon: CirclePlay,
  },
  {
    id: 'on_hold',
    label: 'On Hold',
    className: 'on-hold',
    color: '#e5c07b',
    Icon: CircleMinus,
  },
  {
    id: 'completed',
    label: 'Completed',
    className: 'completed',
    color: '#98c379',
    Icon: CircleCheck,
  },
  {
    id: 'dropped',
    label: 'Dropped',
    className: 'dropped',
    color: '#e06c75',
    Icon: CircleX,
  },
];

export function findStatus(id) {
  return STATUSES.find((s) => s.id === id) || STATUSES[0];
}
