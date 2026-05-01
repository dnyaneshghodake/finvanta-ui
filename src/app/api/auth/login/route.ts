import { NextRequest, NextResponse } from 'next/server';
import { loginService } from '@/server/auth/token.service';
import { createSession } from '@/server/auth/session.service';
import { getSessionCookieHeaders } from '@/server/security/cookie';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { username, password, tenantId } = body;
    
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Username and password are required' } },
        { status: 400 }
      );
    }

    const response = await loginService({ username, password, tenantId });
    
    if (response.requiresMfa) {
      return NextResponse.json({
        success: true,
        requiresMfa: true,
        mfaToken: response.mfaToken,
      });
    }

    await createSession(
      response.user.id,
      response.user.username,
      response.user.email,
      response.user.tenantId,
      response.user.role,
      response.user.permissions,
      response.accessToken,
      response.refreshToken,
      response.expiresIn
    );

    const cookieHeader = getSessionCookieHeaders({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      tenantId: response.user.tenantId,
      role: response.user.role,
      permissions: response.user.permissions,
      exp: Math.floor(Date.now() / 1000) + response.expiresIn,
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: response.user.id,
          username: response.user.username,
          email: response.user.email,
          role: response.user.role,
          tenantId: response.user.tenantId,
        },
      },
      {
        status: 200,
        headers: { 'Set-Cookie': cookieHeader },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    
    return NextResponse.json(
      { success: false, error: { code: 'AUTH_ERROR', message } },
      { status: 401 }
    );
  }
}