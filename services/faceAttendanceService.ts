// Client for the kiosk attendance service on the droplet (repo:
// fredelicacies-face-attendance). It is separate from the POS cashier clock-in:
// its own company-wide staff list (everyone, with or without a POS login; staff
// rotate between branches) and time records, each tagged with the tablet used
// and its GPS location. Managers authenticate with their Supabase session; a paired
// kiosk tablet authenticates with its device token.
import type { DeviceLocation, LocationError } from '@/lib/face/location';
import { supabase } from '@/lib/supabase';

const BASE_URL = process.env.NEXT_PUBLIC_FACE_API_URL ?? '';
const KIOSK_TOKEN_KEY = 'face_kiosk_token';

export class FaceApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

const MESSAGES: Record<string, string> = {
  NO_MATCH: "Face not recognized. Try again, or ask a manager to time you in.",
  SPOOF_SUSPECTED: 'Please look at the camera directly — no photos or screens.',
  NOT_ENROLLED: 'Your face is not set up yet. Ask a manager to enroll you.',
  TOO_MANY_ATTEMPTS: 'Too many failed attempts. Ask a manager to time you in.',
  COOLDOWN: 'You just did this. Please wait a minute before trying again.',
  STATE_CHANGED: 'Your status just changed. Please check your name again.',
  STALE_SHIFT: 'Your last shift was never timed out. Ask a manager to fix it.',
  EMPLOYEE_NOT_FOUND: 'This person is not on the active staff list.',
  BRANCH_NOT_FOUND: 'Branch not found.',
  OPEN_SHIFT: 'Time this person out first.',
  OVERLAPS_PREVIOUS_SHIFT: 'That time overlaps their previous shift.',
  TIME_IN_FUTURE: 'The time cannot be in the future.',
  TIME_OUT_BEFORE_TIME_IN: 'Time out cannot be earlier than time in.',
  INVALID_RANGE: 'Choose a date range of up to 62 days.',
  KIOSK_NOT_PAIRED: 'This tablet is not paired. Ask a manager to pair it.',
  UNAUTHENTICATED: 'Please sign in again.',
  FORBIDDEN: 'You do not have permission to do this.',
  INCONSISTENT_CAPTURES: "The photos didn't look like the same person. Please retake them.",
  DUPLICATE_FACE: 'This face is already enrolled for another person.',
  MODEL_MISMATCH: 'The face engine version changed. Reload the page.',
  NETWORK: "Can't reach the attendance service. Check the internet connection.",
};

export const faceErrorMessage = (err: unknown): string => {
  // The server's own message covers codes the kiosk has no copy for (e.g. FORBIDDEN details).
  if (err instanceof FaceApiError) return MESSAGES[err.code] ?? err.message;
  if (err instanceof Error) {
    // Raised by the on-tablet face check (lib/face/engine.ts, kiosk FaceCheckModal).
    if (err.message === 'TIMEOUT') return "Couldn't get a clear look at your face. Please try again.";
    if (err.message === 'NO_TURN') return "We didn't see you turn your head. Please try again and follow the prompts.";
    if (err.message === 'LOST_FACE') return 'Keep your face in view the whole time. Please try again.';
    if (err.message === 'FACE_CHANGED') return 'Only the same person should be in front of the camera. Please try again.';
  }
  return 'Something went wrong. Please try again.';
};

async function request<T>(path: string, init: RequestInit & { auth: 'manager' | 'kiosk' }): Promise<T> {
  if (!BASE_URL) throw new FaceApiError(0, 'NETWORK', 'NEXT_PUBLIC_FACE_API_URL is not set');
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');

  if (init.auth === 'manager') {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new FaceApiError(401, 'UNAUTHENTICATED');
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    const token = kioskToken.get();
    if (!token) throw new FaceApiError(401, 'KIOSK_NOT_PAIRED');
    headers.set('X-Kiosk-Token', token);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new FaceApiError(0, 'NETWORK');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new FaceApiError(res.status, body.error ?? 'UNKNOWN', body.message);
  return body as T;
}

// localStorage can throw (private mode, blocked storage); the kiosk then simply shows as unpaired.
export const kioskToken = {
  get(): string | null {
    try {
      return localStorage.getItem(KIOSK_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(KIOSK_TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KIOSK_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export type KioskAction = 'time_in' | 'time_out';

export interface KioskWorker {
  /** Employee id in the kiosk staff list. */
  workerId: string;
  name: string;
  position: string | null;
  enrolled: boolean;
  openSince: string | null;
  lastAction: KioskAction | null;
  lastActionAt: string | null;
  status: 'in' | 'out';
  nextAction: KioskAction;
  stale: boolean;
  blockedReason: string | null;
}

export interface KioskRoster {
  serverTime: string;
  device: { id: string; label: string };
  workers: KioskWorker[];
}

export interface KioskDevice {
  id: string;
  label: string;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

export interface Employee {
  id: string;
  name: string;
  position: string | null;
  active: boolean;
  createdAt: string;
  enrolled: boolean;
  captures: number;
  enrolledAt: string | null;
  /** Set while the person is timed in. */
  openSince: string | null;
}

export interface TimeRecord {
  id: string;
  employeeId: string;
  name: string;
  position: string | null;
  timeIn: string;
  timeOut: string | null;
  timeInMethod: 'face' | 'manual';
  timeOutMethod: 'face' | 'manual' | null;
  /** Null while the shift is open. */
  minutes: number | null;
  /** Name of the kiosk tablet used; null for manual entries. */
  timeInDevice: string | null;
  timeOutDevice: string | null;
  /** Kiosk tablet location at the face check; null for manual entries or when unavailable. */
  timeInLocation: DeviceLocation | null;
  timeOutLocation: DeviceLocation | null;
}

export const faceAttendanceService = {
  // Manager (company-wide; nothing is scoped to a branch)
  pairDevice: (label: string) =>
    request<{ device: KioskDevice; token: string }>('/devices', {
      auth: 'manager',
      method: 'POST',
      body: JSON.stringify({ label }),
    }),
  listDevices: () => request<{ devices: KioskDevice[] }>('/devices', { auth: 'manager' }),
  revokeDevice: (deviceId: string) => request<void>(`/devices/${deviceId}`, { auth: 'manager', method: 'DELETE' }),

  // Staff list: anyone with manager access can view; adding/editing needs admin or owner (canAdmin).
  listEmployees: () => request<{ canAdmin: boolean; employees: Employee[] }>('/employees', { auth: 'manager' }),
  addEmployee: (name: string, position: string | null) =>
    request<{ employee: Employee }>('/employees', {
      auth: 'manager',
      method: 'POST',
      body: JSON.stringify({ name, position }),
    }),
  updateEmployee: (employeeId: string, changes: { name?: string; position?: string | null; active?: boolean }) =>
    request<{ ok: true }>(`/employees/${employeeId}`, {
      auth: 'manager',
      method: 'PATCH',
      body: JSON.stringify(changes),
    }),

  enroll: (employeeId: string, embeddings: number[][], model: string) =>
    request<{ captures: number }>('/enrollments', {
      auth: 'manager',
      method: 'POST',
      body: JSON.stringify({ employeeId, consent: true, model, embeddings }),
    }),
  deleteEnrollment: (employeeId: string) =>
    request<{ deleted: number }>(`/enrollments/${employeeId}`, { auth: 'manager', method: 'DELETE' }),

  // Time records
  listRecords: (from: Date, to: Date) =>
    request<{ records: TimeRecord[] }>(
      `/attendance?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      { auth: 'manager' },
    ),
  manualPunch: (employeeId: string, action: KioskAction, at?: Date) =>
    request<{ action: KioskAction; at: string }>(`/attendance/${action === 'time_in' ? 'time-in' : 'time-out'}`, {
      auth: 'manager',
      method: 'POST',
      body: JSON.stringify({ employeeId, at: at?.toISOString() }),
    }),

  // Kiosk
  roster: () => request<KioskRoster>('/kiosk/roster', { auth: 'kiosk' }),
  punch: (payload: {
    workerId: string;
    expected: KioskAction;
    model: string;
    embedding: number[];
    antispoof: number;
    liveness: number;
    location: DeviceLocation | null;
    locationError: LocationError | null;
  }) =>
    request<{ action: KioskAction; at: string; name: string }>('/kiosk/punch', {
      auth: 'kiosk',
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
