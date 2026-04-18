'use client';

import Link from 'next/link';
import { Button, Card } from '@/components/atoms';

/**
 * Home/Landing page
 */
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                CB
              </div>
              <span className="font-bold text-lg text-gray-900">CBS Banking</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Create Account</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Enterprise Banking Made Simple
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Experience secure, fast, and reliable digital banking with CBS Banking - 
            built for modern banking needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg">Get Started</Button>
            </Link>
            <Button size="lg" variant="secondary">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Why Choose CBS Banking?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '🔒',
                title: 'Bank-Grade Security',
                description: 'Enterprise-level encryption and security protocols protect your data 24/7',
              },
              {
                icon: '⚡',
                title: 'Lightning Fast',
                description: 'Process transactions in milliseconds with our optimized infrastructure',
              },
              {
                icon: '📱',
                title: 'Mobile First',
                description: 'Access your accounts anytime, anywhere with our responsive design',
              },
              {
                icon: '💳',
                title: 'Multi-Account',
                description: 'Manage multiple accounts from a single dashboard',
              },
              {
                icon: '🌍',
                title: 'Global Reach',
                description: 'Transfer money worldwide with competitive exchange rates',
              },
              {
                icon: '📊',
                title: 'Analytics',
                description: 'Get insights into your spending with detailed analytics',
              },
            ].map((feature, index) => (
              <Card key={index} className="text-center">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-6">
            Ready to Transform Your Banking?
          </h2>
          <p className="text-blue-100 mb-8">
            Join thousands of satisfied customers using CBS Banking
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" fullWidth>
              Create Your Account Now
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-bold mb-4">About Us</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">About CBS</Link></li>
                <li><Link href="#" className="hover:text-white">Careers</Link></li>
                <li><Link href="#" className="hover:text-white">Press</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Products</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">Accounts</Link></li>
                <li><Link href="#" className="hover:text-white">Cards</Link></li>
                <li><Link href="#" className="hover:text-white">Loans</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">Help Center</Link></li>
                <li><Link href="#" className="hover:text-white">Contact Us</Link></li>
                <li><Link href="#" className="hover:text-white">Status</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">Privacy</Link></li>
                <li><Link href="#" className="hover:text-white">Terms</Link></li>
                <li><Link href="#" className="hover:text-white">Security</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2026 CBS Banking. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
