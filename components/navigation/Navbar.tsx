'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }: any) => {
        if (data?.user?.email) {
          setUserEmail(data.user.email);
        }
      });
    } catch {
      // Ignored in local dev mode
    }
  }, []);

  async function handleSignOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUserEmail(null);
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  }

  const navLinks = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/discovery', label: 'Job Discovery' },
    { href: '/dashboard/intelligence', label: 'Intelligence' },
    { href: '/dashboard/resume', label: 'Resume Studio' },
    { href: '/dashboard/applications', label: 'Applications' },
    { href: '/dashboard/analytics', label: 'Analytics' },
    { href: '/dashboard/settings', label: 'Settings' }
  ];

  return (
    <nav className="border-b border-slate-200 bg-white sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center space-x-6">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white shadow-sm">
              CP
            </span>
            <span className="font-bold text-slate-900 tracking-tight text-base">
              CareerPilot
            </span>
          </Link>

          <div className="hidden sm:flex sm:items-center sm:space-x-1">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {userEmail ? (
            <div className="flex items-center space-x-3">
              <span className="hidden text-xs text-slate-500 md:inline">
                {userEmail}
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
