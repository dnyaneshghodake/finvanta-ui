import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshTokenService } from '@/server/auth/token.service';
import { getSessionCookieHeaders } from '@/server/security/cookie';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('__refresh')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'Refresh token not found' } },
        { status: 401 }
      );
    }

    const response = await refreshTokenService(refreshToken);

    const cookieHeader = getSessionCookieHeaders({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      tenantId: '',
      role: '',
      permissions: [],
      exp: Math.floor(Date.now() / 1000) + response.expiresIn,
    });

    return NextResponse.json(
      { success: true },
      {
        status: 200,
        headers: { 'Set-Cookie': cookieHeader },
      }
    );
  } catch (error) {
    const cookieStore = await cookies();
    cookieStore.delete('__session');
    cookieStore.delete('__refresh');
    
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    
    return NextResponse.json(
      { success: false, error: { code: 'REFRESH_ERROR', message } },
      { status: 401 }
    );
  }
}