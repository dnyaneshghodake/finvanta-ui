import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};

const PUBLIC_PATHS = ['/login', '/mfa', '/api/auth/login', '/api/auth/mfa', '/api/auth/refresh'];
const ROLE_ROUTES: Record<string, string[]> = {
  '/admin': ['ADMIN'],
  '/maker': ['ADMIN', 'MAKER'],
  '/checker': ['ADMIN', 'MAKER', 'CHECKER'],
  '/teller': ['ADMIN', 'MAKER', 'CHECKER', 'TELLER'],
  '/customer': ['ADMIN', 'MAKER', 'CHECKER', 'TELLER', 'CUSTOMER'],
};

function getSessionCookie() {
  return cookies().get('__session');
}

function decodeSessionPayload(payload: string): { accessToken?: string; tenantId?: string; role?: string; exp?: number } | null {
  try {
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isSessionExpired(exp: number | undefined): boolean {
  if (!exp) return true;
  return Date.now() >= exp * 1000;
}

function getRoleFromPath(pathname: string): string[] {
  for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route)) return roles;
  }
  return ['ADMIN', 'MAKER', 'CHECKER', 'TELLER', 'CUSTOMER'];
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.includes('.')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/proxy')) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isPublicPath) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie();
  if (!sessionCookie?.value) {
    return redirectToLogin(pathname);
  }

  const session = decodeSessionPayload(sessionCookie.value);
  if (!session?.accessToken || isSessionExpired(session.exp)) {
    const refreshToken = cookies().get('__refresh')?.value;
    if (!refreshToken) {
      return redirectToLogin(pathname);
    }
    
    try {
      const refreshResponse = await fetch(new URL('/api/auth/refresh', request.url), {
        method: 'POST',
        headers: { 
          'Cookie': `__refresh=${refreshToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!refreshResponse.ok) {
        return redirectToLogin(pathname);
      }
      
      const newSessionCookie = refreshResponse.headers.get('set-cookie');
      if (!newSessionCookie) {
        return redirectToLogin(pathname);
      }
      
      const response = NextResponse.next();
      response.headers.set('set-cookie', newSessionCookie);
      return response;
    } catch {
      return redirectToLogin(pathname);
    }
  }

  const allowedRoles = getRoleFromPath(pathname);
  const userRole = session.role;
  if (userRole && !allowedRoles.includes(userRole)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  const requestHeaders = new Headers(request.headers);
  if (session.tenantId) {
    requestHeaders.set('X-Tenant-Id', session.tenantId);
  }
  if (session.accessToken) {
    requestHeaders.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (session.tenantId) {
    response.headers.set('X-Tenant-Id', session.tenantId);
  }

  return response;
}

function redirectToLogin(pathname: string) {
  const loginUrl = new URL('/login', 'http://localhost');
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}