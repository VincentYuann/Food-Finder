import React from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

export function StatusBadge({ status, type = 'phase', className = '' }) {
  if (type === 'openStatus') {
    const isOpen = Boolean(status);
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          isOpen
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
            : 'bg-rose-50 text-rose-700 border border-rose-200/80'
        } ${className}`}
      >
        {isOpen ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
        {isOpen ? 'Open Now' : 'Closed'}
      </span>
    );
  }

  if (type === 'ready') {
    const isReady = Boolean(status);
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide uppercase ${
          isReady
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-slate-100 text-slate-600'
        } ${className}`}
      >
        {isReady ? 'Ready' : 'Not ready'}
      </span>
    );
  }

  // Lobby Phase status
  const normalized = String(status || 'active').toLowerCase();
  const phaseStyles = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    voting: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse-subtle',
    closed: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold capitalize border ${
        phaseStyles[normalized] || phaseStyles.active
      } ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {normalized}
    </span>
  );
}
