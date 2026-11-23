import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDeviceLocation } from '@/lib/face/location';
import { faceAttendanceService, faceErrorMessage, kioskToken } from '@/services/faceAttendanceService';

const MANAGE_ROLES = new Set(['admin', 'owner', 'manager']);

// One-time setup on the tablet: a manager signs in and names the tablet, and it
// receives its own device token. Tablets aren't tied to a branch: every tablet
// lists all staff, and its GPS location records where each punch happened.
// If the manager signed in only for this, they are signed out again so the
// tablet is not left logged in.
export default function KioskPairing({ onPaired }: { onPaired: () => void }) {
  const { user, realRole, login, logout, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedInHere, setSignedInHere] = useState(false);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPair = Boolean(user && realRole && MANAGE_ROLES.has(realRole));

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
      const { token } = await faceAttendanceService.pairDevice(label.trim() || 'Kiosk tablet');
      kioskToken.set(token);
      // Ask for location permission now, while the manager is here, so the
      // first person timing in isn't met with a browser prompt.
      await getDeviceLocation();
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
          A manager or owner pairs this tablet once. After that, any staff member can time in and out here without
          signing in.
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
              Tablet name
              <input
                className={`${input} mt-1`}
                value={label}
                maxLength={60}
                placeholder='e.g. Talisay front counter'
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <button disabled={busy} onClick={pair} className='w-full py-3 rounded-lg bg-accent text-primary font-black disabled:opacity-50'>
              {busy ? 'Pairing…' : 'PAIR THIS TABLET'}
            </button>
            <p className='text-3 text-secondary/60'>
              Signed in as {user.name}. When the browser asks, allow location: it is recorded with each time in and out.
            </p>
          </div>
        )}

        {error && <p className='mt-4 text-3.5 text-error'>{error}</p>}
      </div>
    </div>
  );
}
