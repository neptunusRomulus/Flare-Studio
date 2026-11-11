import { ArrowDownCircle, ArrowUpCircle, FlaskConical, Flag, Flame, Skull, Wand2 } from 'lucide-react';
import { KIND_META, type ContentKind } from '@/editor/powers/powerKinds';

const ICONS = { Wand2, Skull, FlaskConical, Flame, ArrowUpCircle, ArrowDownCircle, Flag };

export const KindIcon = ({ kind, className = 'w-3.5 h-3.5' }: { kind: ContentKind; className?: string }) => {
  const meta = KIND_META[kind];
  const Icon = ICONS[meta.icon];
  return <Icon className={`${className} ${meta.color} shrink-0`} aria-hidden />;
};
