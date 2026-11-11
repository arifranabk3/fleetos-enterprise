export function formatCents(cents: number, currency = 'USD'): string {
  if (isNaN(cents) || !isFinite(cents)) return `${currency} 0.00`;
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString?: string | Date): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'PAID':
    case 'ACTIVE':
    case 'APPROVED':
    case 'RECONCILED':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'ISSUED':
    case 'CALCULATED':
    case 'RECORDED':
      return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    case 'PARTIALLY_PAID':
    case 'PENDING':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'OVERDUE':
    case 'DISPUTED':
    case 'REJECTED':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    case 'VOID':
    case 'ARCHIVED':
    case 'REVERSED':
      return 'bg-graphite-500/10 text-graphite-400 border-graphite-500/20';
    case 'DRAFT':
    default:
      return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
  }
}

