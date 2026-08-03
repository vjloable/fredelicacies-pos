// Helpers for turning Postgres/Supabase errors into user-facing messages.

// Postgres unique-violation is SQLSTATE 23505. `hint` (e.g. an index/constraint name
// or column) narrows the match so we only claim "duplicate X" for the right conflict.
export function isUniqueViolation(error: unknown, hint?: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  if (e.code !== '23505') return false;
  if (!hint) return true;
  const text = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`.toLowerCase();
  return text.includes(hint.toLowerCase());
}
