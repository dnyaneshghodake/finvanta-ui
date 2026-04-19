'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { accountService } from '@/services/api/accountService';
import { useUIStore } from '@/store/uiStore';
import { Button, Alert, Card } from '@/components/atoms';

/**
 * Create account form validation schema
 */
const createAccountSchema = z.object({
  accountType: z.enum(['SAVINGS', 'CURRENT', 'SALARY']),
  currency: z.string(),
});

type CreateAccountFormData = z.infer<typeof createAccountSchema>;

/**
 * Create account page
 */
export default function CreateAccountPage() {
  const router = useRouter();
  const { addToast } = useUIStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAccountFormData>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      accountType: 'SAVINGS',
      currency: 'INR',
    },
  });

  const onSubmit = async (data: CreateAccountFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await accountService.createAccount(data);

      if (response.success && response.data) {
        addToast({
          type: 'success',
          title: 'Account Created',
          message: `Your ${data.accountType} account has been created successfully`,
          duration: 3000,
        });

        router.push(`/accounts/${response.data.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account';
      setError(message);

      addToast({
        type: 'error',
        title: 'Error',
        message: message,
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create New Account</h1>
        <p className="text-gray-600 mt-1">Choose the account type that suits your needs</p>
      </div>

      {/* Create Account Form */}
      <Card className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Account Details</h2>

        {error && <Alert type="error" title="Error" message={error} />}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Account Type *</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('accountType')}
            >
              <option value="SAVINGS">Savings Account</option>
              <option value="CURRENT">Current Account</option>
              <option value="SALARY">Salary Account</option>
            </select>
            {errors.accountType && (
              <p className="text-red-500 text-sm mt-1">{errors.accountType.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Currency *</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register('currency')}
            >
              <option value="INR">Indian Rupee (₹)</option>
              <option value="USD">US Dollar ($)</option>
              <option value="EUR">Euro (€)</option>
              <option value="GBP">British Pound (£)</option>
            </select>
            {errors.currency && (
              <p className="text-red-500 text-sm mt-1">{errors.currency.message}</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Terms & Conditions</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ Account opening is free with no hidden charges</li>
              <li>✓ Minimum balance requirements apply as per account type</li>
              <li>✓ You can manage multiple accounts from your dashboard</li>
              <li>✓ Account details will be sent to your registered email</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
            <Link href="/accounts" className="flex-1">
              <Button fullWidth size="lg" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
