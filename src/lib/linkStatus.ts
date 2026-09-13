import { Clock, Lock, Globe } from 'lucide-react';
import { LinkStatus } from '../types';

export const statusMeta: Record<
  LinkStatus,
  {
    label: string;
    tabLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    activeClass: string;
  }
> = {
  pending: {
    label: 'À valider',
    tabLabel: 'À valider',
    icon: Clock,
    activeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  private: {
    label: 'Privé',
    tabLabel: 'Privés',
    icon: Lock,
    activeClass: 'bg-slate-200 text-slate-800 border-slate-400',
  },
  public: {
    label: 'Public',
    tabLabel: 'Publics',
    icon: Globe,
    activeClass: 'bg-green-100 text-green-800 border-green-300',
  },
};
