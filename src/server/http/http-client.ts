export interface HttpClientOptions extends RequestInit {
  timeout?: number;
  retryOnUnauthorized?: boolean;
}

export interface HttpClientResponse<T = unknown> {
  data: T | null;
  error: HttpClientError | null;
  status: number;
}

export interface HttpClientError {
  code: string;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 1;

export class HttpClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string = 'HTTP_ERROR',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

export async function createHttpClient(baseUrl: string) {
  async function request<T = unknown>(
    endpoint: string,
    options: HttpClientOptions = {}
  ): Promise<HttpClientResponse<T>> {
    const {
      timeout = DEFAULT_TIMEOUT,
      retryOnUnauthorized = false,
      ...fetchOptions
    } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      let data: T | null = null;
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      }

      if (!response.ok) {
        const errorData = typeof data === 'object' ? data as Record<string, unknown> : null;
        return {
          data: null,
          error: new HttpClientError(
            errorData?.message as string || response.statusText || 'Request failed',
            response.status,
            errorData?.code as string || 'HTTP_ERROR',
            errorData?.details as Record<string, unknown>
          ),
          status: response.status,
        };
      }

      return { data, error: null, status: response.status };
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return {
            data: null,
            error: new HttpClientError('Request timeout', 408, 'TIMEOUT'),
            status: 408,
          };
        }
        return {
          data: null,
          error: new HttpClientError(err.message, 500, 'NETWORK_ERROR'),
          status: 500,
        };
      }
      
      return {
        data: null,
        error: new HttpClientError('Unknown error', 500, 'UNKNOWN'),
        status: 500,
      };
    }
  }

  async function get<T = unknown>(
    endpoint: string,
    options?: HttpClientOptions
  ): Promise<HttpClientResponse<T>> {
    return request<T>(endpoint, { ...options, method: 'GET' });
  }

  async function post<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: HttpClientOptions
  ): Promise<HttpClientResponse<T>> {
    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function put<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: HttpClientOptions
  ): Promise<HttpClientResponse<T>> {
    return request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: HttpClientOptions
  ): Promise<HttpClientResponse<T>> {
    return request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function delete<T = unknown>(
    endpoint: string,
    options?: HttpClientOptions
  ): Promise<HttpClientResponse<T>> {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  return { request, get, post, put, patch, delete };
}

export const httpClient = createHttpClient(process.env.BACKEND_API_URL || 'http://localhost:8080');