import type { KioskWorker } from '@/services/faceAttendanceService';
import { formatWhen } from '../format';

interface WorkerCardProps {
  worker: KioskWorker;
  now: Date;
  highlighted: boolean;
  onSelect: (worker: KioskWorker) => void;
}

// One name on the kiosk grid: current status plus the single next action.
export default function WorkerCard({ worker, now, highlighted, onSelect }: WorkerCardProps) {
  const isIn = worker.status === 'in';
  const unavailable = !worker.enrolled || Boolean(worker.blockedReason);

  let statusLine: React.ReactNode;
  if (isIn && worker.openSince) {
    statusLine = (
      <span className='flex items-center gap-1.5 text-success font-semibold'>
        <span className='w-2 h-2 rounded-full bg-success' />
        IN · since {formatWhen(worker.openSince, now)}
      </span>
    );
  } else if (worker.lastAction === 'time_out' && worker.lastActionAt) {
    statusLine = (
      <span className='flex items-center gap-1.5 text-secondary/60'>
        <span className='w-2 h-2 rounded-full border border-secondary/40' />
        OUT · {formatWhen(worker.lastActionAt, now)}
      </span>
    );
  } else {
    statusLine = <span className='text-secondary/40'>No record yet</span>;
  }

  const note = !worker.enrolled
    ? 'Face not set up — see a manager'
    : worker.blockedReason === 'STALE_SHIFT'
      ? 'Last shift not timed out — see a manager'
      : null;

  return (
    <button
      type='button'
      onClick={() => onSelect(worker)}
      className={`flex flex-col text-left gap-3 p-4 rounded-xl border-2 bg-white transition-all active:scale-[0.98] ${
        highlighted ? 'border-success shadow-lg' : isIn ? 'border-success/30' : 'border-secondary/10'
      } ${unavailable ? 'opacity-60' : 'hover:shadow-md'}`}>
      <div className='flex items-center gap-3 min-w-0'>
        <div
          className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center font-bold text-4 ${
            isIn ? 'bg-success/15 text-success' : 'bg-light-accent text-secondary'
          }`}>
          {worker.name.charAt(0).toUpperCase()}
        </div>
        <div className='min-w-0'>
          <div className='font-bold text-4 text-secondary truncate'>{worker.name}</div>
          {worker.position && <div className='text-3 text-secondary/50 truncate'>{worker.position}</div>}
          <div className='text-3 mt-0.5'>{statusLine}</div>
        </div>
      </div>

      {note ? (
        <div className='text-3 text-secondary/70 bg-gray-50 rounded-lg px-3 py-2.5 text-center'>{note}</div>
      ) : (
        <div
          className={`text-3.5 font-black tracking-wide rounded-lg py-2.5 text-center text-primary ${
            worker.nextAction === 'time_out' ? 'bg-secondary' : 'bg-success'
          }`}>
          {worker.nextAction === 'time_out' ? 'TIME OUT' : 'TIME IN'}
        </div>
      )}
    </button>
  );
}
