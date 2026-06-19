import { AttendanceStatus, SessionStatus } from '@/lib/types';

interface Props {
  status: AttendanceStatus | SessionStatus | string;
  size?: 'sm' | 'md';
}

const LABELS: Record<string, { label: string; cls: string }> = {
  present:        { label: 'Present',        cls: 'badge-success' },
  absent:         { label: 'Absent',          cls: 'badge-danger'  },
  pending_review: { label: 'Pending Review',  cls: 'badge-warning' },
  conducted:      { label: 'Conducted',       cls: 'badge-success' },
  missed:         { label: 'Missed',          cls: 'badge-danger'  },
  scheduled:      { label: 'Scheduled',       cls: 'badge-accent'  },
  cancelled:      { label: 'Cancelled',       cls: 'badge-muted'   },
  rescheduled:    { label: 'Rescheduled',     cls: 'badge-muted'   },
  trial:          { label: 'Trial',           cls: 'badge-accent'  },
  active:         { label: 'Active',          cls: 'badge-success' },
  converted:      { label: 'Converted',       cls: 'badge-success' },
  inactive:       { label: 'Inactive',        cls: 'badge-muted'   },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const conf = LABELS[status] ?? { label: status, cls: 'badge-muted' };
  return (
    <span className={`badge ${conf.cls}`} style={size === 'sm' ? { fontSize: 10, padding: '2px 6px' } : {}}>
      <span className="badge-dot" />
      {conf.label}
    </span>
  );
}
