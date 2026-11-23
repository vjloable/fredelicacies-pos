import type { ReactNode } from 'react';

// Small shared pieces for the Staff Attendance panels.

export function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className='fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50'>
      <div className='bg-white rounded-2xl p-6 max-w-md w-full max-h-full overflow-y-auto'>
        <div className='flex items-start justify-between mb-5'>
          <div>
            <h3 className='text-lg font-bold text-secondary'>{title}</h3>
            {subtitle && <p className='text-xs text-secondary/70'>{subtitle}</p>}
          </div>
          <button aria-label='Close' onClick={onClose} className='text-gray-400 hover:text-gray-600 p-2'>
            ✕
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
    <Modal title={title} onClose={onCancel}>
      <p className='text-3.5 text-secondary/70 mb-6'>{message}</p>
      <div className='flex gap-3'>
        <button onClick={onCancel} className={secondaryButton}>
          Cancel
        </button>
        <button disabled={busy} onClick={onConfirm} className='flex-1 py-2.5 rounded-lg bg-error text-primary font-black disabled:opacity-50'>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export const MethodBadge = ({ method }: { method: 'face' | 'manual' | null }) =>
  method ? (
    <span
      className={`ml-1.5 text-2.5 font-bold px-1.5 py-0.5 rounded ${
        method === 'face' ? 'bg-success/10 text-success' : 'bg-accent/15 text-accent'
      }`}>
      {method === 'face' ? 'FACE' : 'MANUAL'}
    </span>
  ) : null;

export const input = 'w-full border border-secondary/20 rounded-lg px-3 py-2 text-3.5 text-secondary bg-white';
export const primaryButton = 'flex-1 py-2.5 rounded-lg bg-accent text-primary font-black disabled:opacity-50';
export const secondaryButton = 'flex-1 py-2.5 rounded-lg border border-secondary/20 text-secondary font-semibold';
export const panel = 'bg-white rounded-xl border border-secondary/10 p-5';
