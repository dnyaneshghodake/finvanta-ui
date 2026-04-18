'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { FormField } from '@/components/molecules';
import { Button, Alert, Card } from '@/components/atoms';

/**
 * Login form validation schema
 */
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Login page
 */
export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { addToast } = useUIStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);

    try {
      await login(data.email, data.password);
      
      addToast({
        type: 'success',
        title: 'Login Successful',
        message: 'Welcome back!',
        duration: 2000,
      });

      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      
      addToast({
        type: 'error',
        title: 'Login Failed',
        message: message,
        duration: 3000,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-blue-600">
            <span className="text-white font-bold text-lg">CB</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">CBS Banking</h1>
          <p className="mt-2 text-gray-600">Enterprise Banking Solution</p>
        </div>

        {/* Login Card */}
        <Card variant="elevated" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
            <p className="text-gray-600 text-sm mt-1">
              Enter your credentials to access your account
            </p>
          </div>

          {error && <Alert type="error" title="Login Failed" message={error} />}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              fullWidth
              {...register('email')}
            />

            <FormField
              label="Password"
              type="password"
              placeholder="Enter your password"
              error={errors.password?.message}
              fullWidth
              {...register('password')}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  {...register('rememberMe')}
                />
                <span className="ml-2 text-sm text-gray-700">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Don't have an account?</span>
            </div>
          </div>

          <Link href="/register">
            <Button fullWidth variant="secondary" size="lg">
              Create Account
            </Button>
          </Link>
        </Card>

        {/* Demo Credentials */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 mb-2">Demo Credentials:</p>
          <p className="text-xs text-blue-700">Email: demo@example.com</p>
          <p className="text-xs text-blue-700">Password: Demo@1234</p>
        </div>
      </div>
    </div>
  );
}
