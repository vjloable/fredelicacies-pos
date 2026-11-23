import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { branchService } from '@/services/branchService';
import { faceAttendanceService, faceErrorMessage, kioskToken } from '@/services/faceAttendanceService';
import type { Branch } from '@/types/domain/branch';

const MANAGE_ROLES = new Set(['admin', 'owner', 'manager']);

// One-time setup on the tablet: a manager signs in, picks the branch, and the
// tablet receives its own device token. If the manager signed in only for this,
// they are signed out again so the tablet is not left logged in.
export default function KioskPairing({ onPaired }: { onPaired: () => void }) {
  const { user, realRole, login, logout, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedInHere, setSignedInHere] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [label, setLabel] = useState('Kiosk tablet');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPair = Boolean(user && realRole && MANAGE_ROLES.has(realRole));

  useEffect(() => {
    if (!canPair) return;
    branchService.getAllBranches().then(({ branches }) => {
      const active = (branches ?? []).filter((b) => b.status === 'active');
      setBranches(active);
      setBranchId((cur) => cur || active[0]?.id || '');
    });
  }, [canPair]);

  const signIn = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      setSignedInHere(true);
      setPassword('');
    } catch {
      setError('Wrong email or password.');
    } finally {
      setBusy(false);
    }
  };

  const pair = async () => {
    setBusy(true);
    setError(null);
    try {
      const { token } = await faceAttendanceService.pairDevice(branchId, label.trim() || 'Kiosk tablet');
      kioskToken.set(token);
      if (signedInHere) await logout();
      onPaired();
    } catch (err) {
      setError(faceErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full border border-secondary/20 rounded-lg px-3 py-2.5 text-3.5 text-secondary bg-white';

  return (
    <div className='min-h-screen bg-background flex items-center justify-center p-4'>
      <div className='bg-white rounded-2xl p-8 max-w-md w-full shadow-sm'>
        <h1 className='text-6 font-bold text-secondary'>Set up attendance kiosk</h1>
        <p className='text-3.5 text-secondary/70 mt-1 mb-6'>
          A manager or owner pairs this tablet to a branch once. After that, staff time in and out here without signing in.
        </p>

        {authLoading ? (
          <p className='text-3.5 text-secondary/60'>Loading…</p>
        ) : !user ? (
          <form onSubmit={signIn} className='space-y-3'>
            <input className={input} type='email' autoComplete='username' placeholder='Manager email' value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input className={input} type='password' autoComplete='current-password' placeholder='Password' value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button disabled={busy} className='w-full py-3 rounded-lg bg-accent text-primary font-black disabled:opacity-50'>
              {busy ? 'Signing in…' : 'SIGN IN'}
            </button>
          </form>
        ) : !canPair ? (
          <div className='space-y-4'>
            <p className='text-3.5 text-error'>Only managers and owners can pair a kiosk. You are signed in as {user.name}.</p>
            <button onClick={() => logout()} className='w-full py-3 rounded-lg border border-secondary/20 text-secondary font-semibold'>
              Sign out
            </button>
          </div>
        ) : (
          <div className='space-y-3'>
            <label className='block text-3 font-semibold text-secondary'>
              Branch
              <select className={`${input} mt-1`} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className='block text-3 font-semibold text-secondary'>
              Tablet name
              <input className={`${input} mt-1`} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <button disabled={busy || !branchId} onClick={pair} className='w-full py-3 rounded-lg bg-accent text-primary font-black disabled:opacity-50'>
              {busy ? 'Pairing…' : 'PAIR THIS TABLET'}
            </button>
            <p className='text-3 text-secondary/60'>Signed in as {user.name}.</p>
          </div>
        )}

        {error && <p className='mt-4 text-3.5 text-error'>{error}</p>}
      </div>
    </div>
  );
}
