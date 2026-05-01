import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/server/http/api-client';

interface RouteParams {
  params: Promise<{
    path: string[];
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { path } = await params;
    const endpoint = '/' + path.join('/');
    const queryString = request.nextUrl.search;

    const response = await api.get(
      queryString ? `${endpoint}${queryString}` : endpoint
    );

    if (response.error) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { path } = await params;
    const endpoint = '/' + path.join('/');

    const body = await request.json();

    const response = await api.post(endpoint, body);

    if (response.error) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { path } = await params;
    const endpoint = '/' + path.join('/');

    const body = await request.json();

    const response = await api.put(endpoint, body);

    if (response.error) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { path } = await params;
    const endpoint = '/' + path.join('/');

    const body = await request.json();

    const response = await api.patch(endpoint, body);

    if (response.error) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { path } = await params;
    const endpoint = '/' + path.join('/');

    const response = await api.delete(endpoint);

    if (response.error) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data: response.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy request failed';
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message } },
      { status: 500 }
    );
  }
}