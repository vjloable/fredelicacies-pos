import { useCallback, useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { formatManilaDay } from '@/lib/manilaTime';
import { faceAttendanceService, faceErrorMessage, type Employee } from '@/services/faceAttendanceService';
import EnrollFaceModal from './EnrollFaceModal';
import EmployeeFormModal from './EmployeeFormModal';
import {
  Avatar,
  Badge,
  Chips,
  ConfirmModal,
  EmptyState,
  ErrorBanner,
  Icon,
  LiveDot,
  panel,
  rowAction,
  rowDanger,
  SearchInput,
  SectionHeader,
  smallPrimary,
} from './ui';

type Confirm = { kind: 'removeFace' | 'deactivate'; employee: Employee } | null;
type Filter = 'active' | 'not_enrolled' | 'inactive';

// Kiosk staff list and face enrollment.
export default function StaffPanel() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [canAdmin, setCanAdmin] = useState(false);
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [enrolling, setEnrolling] = useState<Employee | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await faceAttendanceService.listEmployees();
      setEmployees(res.employees);
      setCanAdmin(res.canAdmin);
      setError(null);
    } catch (err) {
      setError(faceErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      setConfirm(null);
      await load();
    } catch (err) {
      setError(faceErrorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const groups = useMemo(() => {
    const all = employees ?? [];
    const active = all.filter((e) => e.active);
    return {
      active,
      not_enrolled: active.filter((e) => !e.enrolled),
      inactive: all.filter((e) => !e.active),
    };
  }, [employees]);

  if (!employees) {
    return (
      <section className={panel}>
        {error ? (
          <div className='p-5'>
            <ErrorBanner message={error} onRetry={load} />
          </div>
        ) : (
          <div className='flex items-center justify-center py-16'>
            <LoadingSpinner size='md' />
          </div>
        )}
      </section>
    );
  }

  const q = search.trim().toLowerCase();
  const shown = groups[filter].filter((e) => !q || e.name.toLowerCase().includes(q) || e.position?.toLowerCase().includes(q));
  const enrolledCount = groups.active.length - groups.not_enrolled.length;
  const enrolledPct = groups.active.length ? Math.round((enrolledCount / groups.active.length) * 100) : 0;

  return (
    <section className={panel}>
      <SectionHeader
        title='Staff'
        description='Everyone who times in at the kiosks, across all branches, with or without a POS login.'
        actions={
          canAdmin && (
            <button onClick={() => setEditing('new')} className={smallPrimary}>
              <Icon.Plus />
              Add staff
            </button>
          )
        }
      />

      {groups.active.length > 0 && (
        <div className='px-5 pb-4'>
          <div className='flex items-center justify-between text-3 mb-1.5'>
            <span className='text-secondary/70'>
              <span className='font-semibold text-secondary tabular-nums'>{enrolledCount}</span> of{' '}
              <span className='tabular-nums'>{groups.active.length}</span> faces enrolled
            </span>
            <span className='text-secondary/50 tabular-nums'>{enrolledPct}%</span>
          </div>
          <div className='h-1.5 rounded-full bg-secondary/5 overflow-hidden'>
            <div className='h-full rounded-full bg-success transition-all' style={{ width: `${enrolledPct}%` }} />
          </div>
        </div>
      )}

      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pb-4 border-b border-secondary/10'>
        <Chips<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'active', label: 'Active', count: groups.active.length },
            { id: 'not_enrolled', label: 'Not enrolled', count: groups.not_enrolled.length },
            { id: 'inactive', label: 'Inactive', count: groups.inactive.length },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder='Search name or position' />
      </div>

      {error && (
        <div className='px-5 pt-4'>
          <ErrorBanner message={error} />
        </div>
      )}

      {shown.length === 0 ? (
        q ? (
          <EmptyState icon={<Icon.Search className='w-5 h-5' />} title='No matches'>
            Nobody matches “{search.trim()}”.
          </EmptyState>
        ) : filter === 'not_enrolled' ? (
          <EmptyState icon={<Icon.Check className='w-5 h-5' />} title='Everyone is enrolled'>
            All active staff can use the kiosk.
          </EmptyState>
        ) : filter === 'inactive' ? (
          <EmptyState icon={<Icon.Users className='w-5 h-5' />} title='No inactive staff' />
        ) : (
          <EmptyState
            icon={<Icon.Users className='w-5 h-5' />}
            title='No staff yet'
            action={
              canAdmin && (
                <button onClick={() => setEditing('new')} className={smallPrimary}>
                  <Icon.Plus />
                  Add staff
                </button>
              )
            }>
            Add everyone who times in at the kiosks, then enroll their faces.
          </EmptyState>
        )
      ) : (
        <ul className='divide-y divide-secondary/10'>
          {shown.map((e) => (
            <li key={e.id} className='flex flex-col md:flex-row md:items-center gap-3 px-5 py-3.5 hover:bg-secondary/2'>
              <div className='flex items-center gap-3 min-w-0 flex-1'>
                <Avatar name={e.name} muted={!e.active} />
                <div className='min-w-0'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <span className={`font-semibold truncate ${e.active ? 'text-secondary' : 'text-secondary/40'}`}>{e.name}</span>
                    {e.openSince && (
                      <span className='inline-flex items-center gap-1.5 text-2.5 font-bold uppercase tracking-wide text-success'>
                        <LiveDot />
                        In now
                      </span>
                    )}
                  </div>
                  <div className='flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5'>
                    {e.position && <span className='text-3 text-secondary/50'>{e.position}</span>}
                    {!e.active ? (
                      <Badge tone='muted'>Inactive</Badge>
                    ) : e.enrolled ? (
                      <Badge tone='success' icon={<Icon.Check className='w-3 h-3' />}>
                        Enrolled{e.enrolledAt && ` ${formatManilaDay(e.enrolledAt)}`}
                      </Badge>
                    ) : (
                      <Badge tone='error' icon={<Icon.Alert className='w-3 h-3' />}>
                        Not enrolled
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className='flex flex-wrap items-center gap-1 md:justify-end shrink-0 pl-12 md:pl-0'>
                {e.active ? (
                  <>
                    {canAdmin && (
                      <button onClick={() => setEditing(e)} className={rowAction} title='Edit name or position'>
                        <Icon.Edit className='w-3.5 h-3.5' />
                        Edit
                      </button>
                    )}
                    {e.enrolled && (
                      <button onClick={() => setConfirm({ kind: 'removeFace', employee: e })} className={rowDanger} title='Delete face template'>
                        <Icon.Trash className='w-3.5 h-3.5' />
                        Remove face
                      </button>
                    )}
                    {canAdmin && (
                      <button onClick={() => setConfirm({ kind: 'deactivate', employee: e })} className={rowDanger} title='Remove from the kiosk'>
                        <Icon.UserOff className='w-3.5 h-3.5' />
                        Deactivate
                      </button>
                    )}
                    <button
                      onClick={() => setEnrolling(e)}
                      className={
                        e.enrolled
                          ? 'inline-flex items-center gap-2 h-8 px-3 ml-1 rounded-lg border border-secondary/20 text-3 font-semibold text-secondary hover:bg-secondary/5'
                          : 'inline-flex items-center gap-2 h-8 px-3 ml-1 rounded-lg bg-accent text-3 font-semibold text-primary hover:bg-accent/90'
                      }>
                      <Icon.Face className='w-3.5 h-3.5' />
                      {e.enrolled ? 'Re-enroll' : 'Enroll face'}
                    </button>
                  </>
                ) : (
                  canAdmin && (
                    <button disabled={busy} onClick={() => run(() => faceAttendanceService.updateEmployee(e.id, { active: true }))} className={rowAction}>
                      <Icon.Restore className='w-3.5 h-3.5' />
                      Reactivate
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <EmployeeFormModal employee={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={load} />}
      {enrolling && (
        <EnrollFaceModal
          person={{ id: enrolling.id, name: enrolling.name, enrolled: enrolling.enrolled }}
          onClose={() => setEnrolling(null)}
          onEnrolled={load}
        />
      )}
      {confirm && (
        <ConfirmModal
          busy={busy}
          title={confirm.kind === 'deactivate' ? `Deactivate ${confirm.employee.name}?` : `Remove ${confirm.employee.name}'s face?`}
          message={
            confirm.kind === 'deactivate'
              ? 'They disappear from the kiosk and their face data is erased. Their past time records are kept. Use this when someone leaves.'
              : "Their face template is deleted. They can't use the kiosk until they are enrolled again."
          }
          confirmLabel={confirm.kind === 'deactivate' ? 'Deactivate' : 'Remove face'}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            run(() =>
              confirm.kind === 'deactivate'
                ? faceAttendanceService.updateEmployee(confirm.employee.id, { active: false })
                : faceAttendanceService.deleteEnrollment(confirm.employee.id),
            )
          }
        />
      )}
    </section>
  );
}
