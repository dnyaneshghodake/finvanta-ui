'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '@/services/api/authService';
import { useUIStore } from '@/store/uiStore';
import { FormField } from '@/components/molecules';
import { Button, Alert, Card } from '@/components/atoms';

/**
 * Register form validation schema
 */
const registerSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[0-9]/, 'Password must contain a number')
      .regex(/[!@#$%^&*]/, 'Password must contain a special character'),
    confirmPassword: z.string(),
    dateOfBirth: z.string(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    agreeToTerms: z.boolean().refine((val) => val === true, 'You must agree to the terms'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Register page
 */
export default function RegisterPage() {
  const router = useRouter();
  const { addToast } = useUIStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      dateOfBirth: '',
      gender: 'MALE',
      agreeToTerms: false,
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await authService.register({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        password: data.password,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        agreeToTerms: data.agreeToTerms,
      });

      if (response.success) {
        addToast({
          type: 'success',
          title: 'Registration Successful',
          message: 'Please check your email to verify your account',
          duration: 3000,
        });

        router.push('/login');
      } else {
        setError(response.error?.message || 'Registration failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);

      addToast({
        type: 'error',
        title: 'Registration Failed',
        message: message,
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
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
          <p className="mt-2 text-gray-600">Create Your Account</p>
        </div>

        {/* Register Card */}
        <Card variant="elevated" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
            <p className="text-gray-600 text-sm mt-1">
              Join CBS Banking for secure digital banking
            </p>
          </div>

          {error && <Alert type="error" title="Registration Failed" message={error} />}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="First Name"
                placeholder="John"
                error={errors.firstName?.message}
                {...register('firstName')}
              />
              <FormField
                label="Last Name"
                placeholder="Doe"
                error={errors.lastName?.message}
                {...register('lastName')}
              />
            </div>

            <FormField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              fullWidth
              {...register('email')}
            />

            <FormField
              label="Phone Number"
              type="tel"
              placeholder="9876543210"
              error={errors.phoneNumber?.message}
              fullWidth
              {...register('phoneNumber')}
            />

            <FormField
              label="Date of Birth"
              type="date"
              error={errors.dateOfBirth?.message}
              fullWidth
              {...register('dateOfBirth')}
            />

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Gender</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                {...register('gender')}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <FormField
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              error={errors.password?.message}
              fullWidth
              {...register('password')}
            />

            <FormField
              label="Confirm Password"
              type="password"
              placeholder="Re-enter password"
              error={errors.confirmPassword?.message}
              fullWidth
              {...register('confirmPassword')}
            />

            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                {...register('agreeToTerms')}
              />
              <span className="ml-2 text-sm text-gray-700">
                I agree to the{' '}
                <Link href="/terms" className="text-blue-600 hover:text-blue-700">
                  Terms & Conditions
                </Link>
              </span>
            </label>
            {errors.agreeToTerms && (
              <p className="text-red-500 text-sm">{errors.agreeToTerms.message}</p>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
