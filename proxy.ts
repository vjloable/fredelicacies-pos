import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAINTENANCE_PATH = '/maintenance';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the maintenance page and static assets through
  if (
    pathname === MAINTENANCE_PATH ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/settings?id=eq.global&select=maintenance_mode&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!}`,
        },
      }
    );

    const data = await res.json();
    const maintenanceMode = data?.[0]?.maintenance_mode;

    if (maintenanceMode) {
      return NextResponse.rewrite(new URL(MAINTENANCE_PATH, req.url));
    }
  } catch {
    // If Supabase is unreachable, allow access rather than hard-blocking
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
