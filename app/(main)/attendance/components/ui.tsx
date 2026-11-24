import { useEffect, type ReactNode } from 'react';
import { mapsUrl, type DeviceLocation } from '@/lib/face/location';

// Shared pieces for the admin Attendance screen: flat line icons (no emoji),
// buttons, badges, modals and empty/error states.

// ---- Icons ------------------------------------------------------------------

type IconProps = { className?: string };

const Svg = ({ className = 'w-4 h-4', children }: IconProps & { children: ReactNode }) => (
  <svg
    className={`shrink-0 ${className}`}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth={2}
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'>
    {children}
  </svg>
);

export const Icon = {
  Close: (p: IconProps) => (
    <Svg {...p}>
      <path d='M18 6 6 18M6 6l12 12' />
    </Svg>
  ),
  Plus: (p: IconProps) => (
    <Svg {...p}>
      <path d='M12 5v14M5 12h14' />
    </Svg>
  ),
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx='11' cy='11' r='7' />
      <path d='m20 20-3.5-3.5' />
    </Svg>
  ),
  Pin: (p: IconProps) => (
    <Svg {...p}>
      <path d='M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z' />
      <circle cx='12' cy='9.5' r='2.5' />
    </Svg>
  ),
  Download: (p: IconProps) => (
    <Svg {...p}>
      <path d='M12 4v11M7 10l5 5 5-5M5 20h14' />
    </Svg>
  ),
  Edit: (p: IconProps) => (
    <Svg {...p}>
      <path d='M4 20h4L19 9l-4-4L4 16v4Z' />
      <path d='m13.5 6.5 4 4' />
    </Svg>
  ),
  Trash: (p: IconProps) => (
    <Svg {...p}>
      <path d='M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3' />
    </Svg>
  ),
  UserOff: (p: IconProps) => (
    <Svg {...p}>
      <circle cx='10' cy='8' r='4' />
      <path d='M3 20a7 7 0 0 1 11.5-5.4M16 16l5 5M21 16l-5 5' />
    </Svg>
  ),
  Restore: (p: IconProps) => (
    <Svg {...p}>
      <path d='M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4' />
    </Svg>
  ),
  Face: (p: IconProps) => (
    <Svg {...p}>
      <path d='M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2' />
      <path d='M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0' />
    </Svg>
  ),
  LogIn: (p: IconProps) => (
    <Svg {...p}>
      <path d='M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H4' />
    </Svg>
  ),
  LogOut: (p: IconProps) => (
    <Svg {...p}>
      <path d='M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 16l4-4-4-4M20 12H10' />
    </Svg>
  ),
  Clock: (p: IconProps) => (
    <Svg {...p}>
      <circle cx='12' cy='12' r='9' />
      <path d='M12 7v5l3 2' />
    </Svg>
  ),
  Users: (p: IconProps) => (
    <Svg {...p}>
      <circle cx='9' cy='8' r='3.5' />
      <path d='M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5' />
    </Svg>
  ),
  Tablet: (p: IconProps) => (
    <Svg {...p}>
      <rect x='5' y='2.5' width='14' height='19' rx='2' />
      <path d='M11 18h2' />
    </Svg>
  ),
  Check: (p: IconProps) => (
    <Svg {...p}>
      <path d='m5 12.5 4.5 4.5L19 7.5' />
    </Svg>
  ),
  Alert: (p: IconProps) => (
    <Svg {...p}>
      <circle cx='12' cy='12' r='9' />
      <path d='M12 7.5v5M12 16h.01' />
    </Svg>
  ),
  Hand: (p: IconProps) => (
    <Svg {...p}>
      <path d='M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15.4a1.5 1.5 0 0 1 2.5-1.6L8 16' />
    </Svg>
  ),
  ArrowRight: (p: IconProps) => (
    <Svg {...p}>
      <path d='M5 12h14M13 6l6 6-6 6' />
    </Svg>
  ),
  Calendar: (p: IconProps) => (
    <Svg {...p}>
      <rect x='3.5' y='5' width='17' height='15.5' rx='2' />
      <path d='M3.5 10h17M8 3v4M16 3v4' />
    </Svg>
  ),
  Info: (p: IconProps) => (
    <Svg {...p}>
      <circle cx='12' cy='12' r='9' />
      <path d='M12 11v5M12 8h.01' />
    </Svg>
  ),
  Shield: (p: IconProps) => (
    <Svg {...p}>
      <path d='M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z' />
    </Svg>
  ),
};

// ---- Buttons & inputs -------------------------------------------------------

const btn = 'inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
export const primaryButton = `${btn} flex-1 py-2.5 px-4 rounded-lg bg-accent text-primary text-3.5 hover:bg-accent/90`;
export const secondaryButton = `${btn} flex-1 py-2.5 px-4 rounded-lg border border-secondary/20 text-secondary text-3.5 hover:bg-secondary/5`;
export const dangerButton = `${btn} flex-1 py-2.5 px-4 rounded-lg bg-error text-primary text-3.5 hover:bg-error/90`;
/** Compact header action, e.g. "Add staff". */
export const smallPrimary = `${btn} h-9 px-3.5 rounded-lg bg-accent text-primary text-3 hover:bg-accent/90`;
export const smallSecondary = `${btn} h-9 px-3.5 rounded-lg border border-secondary/20 bg-white text-secondary text-3 hover:bg-secondary/5`;
/** Icon + label row action inside lists. */
export const rowAction = `${btn} h-8 px-2.5 rounded-lg text-3 text-secondary/70 hover:text-secondary hover:bg-secondary/5`;
export const rowDanger = `${btn} h-8 px-2.5 rounded-lg text-3 text-error/80 hover:text-error hover:bg-error/10`;

export const input =
  'w-full h-10 border border-secondary/20 rounded-lg px-3 text-3.5 text-secondary bg-white focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent';
export const panel = 'bg-white rounded-xl border border-secondary/10';

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className='relative w-full sm:w-64'>
      <Icon.Search className='w-4 h-4 text-secondary/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none' />
      <input type='search' value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${input} pl-9 h-9`} />
    </div>
  );
}

/** Segmented filter chips. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className='flex flex-wrap gap-1.5'>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`h-8 px-3 rounded-full text-3 font-semibold border transition-colors ${
            value === o.id ? 'bg-secondary text-primary border-secondary' : 'bg-white border-secondary/15 text-secondary/70 hover:text-secondary'
          }`}>
          {o.label}
          {o.count !== undefined && <span className={`ml-1.5 tabular-nums ${value === o.id ? 'text-primary/70' : 'text-secondary/40'}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---- Display ----------------------------------------------------------------

/** Initials avatar; muted for inactive people. */
export function Avatar({ name, muted = false }: { name: string; muted?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={`w-9 h-9 rounded-full flex items-center justify-center text-3 font-bold shrink-0 ${
        muted ? 'bg-secondary/5 text-secondary/30' : 'bg-light-accent text-secondary'
      }`}>
      {initials || '?'}
    </span>
  );
}

type Tone = 'success' | 'error' | 'accent' | 'muted';
const TONES: Record<Tone, string> = {
  success: 'bg-success/10 text-success',
  error: 'bg-error/10 text-error',
  accent: 'bg-accent/15 text-accent',
  muted: 'bg-secondary/5 text-secondary/50',
};

export function Badge({ tone, icon, children }: { tone: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 h-5.5 px-2 rounded-full text-2.5 font-bold uppercase tracking-wide ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

/** Pulsing dot for people currently timed in. */
export const LiveDot = () => (
  <span className='relative flex w-2 h-2 shrink-0'>
    <span className='absolute inset-0 rounded-full bg-success/60 animate-ping' />
    <span className='relative w-2 h-2 rounded-full bg-success' />
  </span>
);

export const MethodBadge = ({ method }: { method: 'face' | 'manual' | null }) =>
  method === 'face' ? (
    <Badge tone='success' icon={<Icon.Face className='w-3 h-3' />}>
      Face
    </Badge>
  ) : method === 'manual' ? (
    <Badge tone='accent' icon={<Icon.Hand className='w-3 h-3' />}>
      Manual
    </Badge>
  ) : null;

/**
 * Map-pin link to the kiosk tablet's location on Google Maps (± accuracy in the
 * tooltip). Only admins, owners and managers reach this screen, and the API only
 * returns records to them.
 */
export const LocationLink = ({ location }: { location: DeviceLocation | null }) =>
  location ? (
    <a
      href={mapsUrl(location)}
      target='_blank'
      rel='noopener noreferrer'
      title={`Tablet location (± ${Math.round(location.accuracy)} m)`}
      aria-label='Open tablet location in Google Maps'
      className='inline-flex items-center justify-center w-6 h-6 rounded-md text-secondary/50 hover:text-accent hover:bg-accent/10'>
      <Icon.Pin className='w-3.5 h-3.5' />
    </a>
  ) : null;

export function StatCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className={`${panel} p-4 flex items-start gap-3`}>
      <span className='w-9 h-9 rounded-lg bg-light-accent/60 text-accent flex items-center justify-center shrink-0'>{icon}</span>
      <div className='min-w-0'>
        <div className='text-3 text-secondary/60 font-medium'>{label}</div>
        <div className='text-5 font-bold text-secondary tabular-nums leading-tight'>{value}</div>
        {hint && <div className='text-2.5 text-secondary/50 mt-0.5'>{hint}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className='flex flex-col items-center text-center py-12 px-6'>
      <span className='w-12 h-12 rounded-full bg-secondary/5 text-secondary/40 flex items-center justify-center mb-3'>{icon}</span>
      <p className='font-semibold text-secondary'>{title}</p>
      {children && <p className='text-3 text-secondary/60 mt-1 max-w-sm'>{children}</p>}
      {action && <div className='mt-4'>{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role='alert' className='flex items-center gap-3 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-3.5 text-error'>
      <Icon.Alert className='w-4 h-4' />
      <span className='flex-1'>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className='text-3 font-semibold underline underline-offset-2 hover:no-underline'>
          Try again
        </button>
      )}
    </div>
  );
}

export const SectionHeader = ({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) => (
  <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pt-5 pb-4'>
    <div className='min-w-0'>
      <h3 className='font-bold text-secondary text-4'>{title}</h3>
      {description && <p className='text-3 text-secondary/60 mt-0.5'>{description}</p>}
    </div>
    {actions && <div className='flex flex-wrap items-center gap-2 shrink-0'>{actions}</div>}
  </div>
);

// ---- Modals -----------------------------------------------------------------

export function Modal({
  title,
  subtitle,
  icon,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
      <div
        role='dialog'
        aria-modal='true'
        aria-label={title}
        className={`bg-white rounded-2xl p-6 w-full max-h-full overflow-y-auto shadow-xl ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        <div className='flex items-start gap-3 mb-5'>
          {icon && <span className='w-10 h-10 rounded-full bg-light-accent/60 text-accent flex items-center justify-center shrink-0'>{icon}</span>}
          <div className='flex-1 min-w-0'>
            <h3 className='text-4.5 font-bold text-secondary leading-tight'>{title}</h3>
            {subtitle && <p className='text-3 text-secondary/60 mt-0.5'>{subtitle}</p>}
          </div>
          <button aria-label='Close' onClick={onClose} className='-mr-2 -mt-1 p-2 rounded-lg text-secondary/40 hover:text-secondary hover:bg-secondary/5'>
            <Icon.Close className='w-5 h-5' />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      icon={
        <span className='text-error'>
          <Icon.Alert className='w-5 h-5' />
        </span>
      }
      onClose={onCancel}>
      <p className='text-3.5 text-secondary/70 mb-6'>{message}</p>
      <div className='flex gap-3'>
        <button onClick={onCancel} className={secondaryButton}>
          Cancel
        </button>
        <button disabled={busy} onClick={onConfirm} className={dangerButton}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
