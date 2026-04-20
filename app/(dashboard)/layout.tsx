/**
 * Authenticated dashboard route-group layout (Server Component).
 *
 * This file is intentionally a Server Component: the authoritative
 * session check runs on the server BEFORE any dashboard HTML is
 * rendered or streamed to the browser. When the encrypted `fv_sid`
 * cookie is missing or expired, we issue a server-side redirect to
 * `/login?reason=session_expired`. There is no brief "flash" of the
 * dashboard frame for an unauthenticated caller.
 *
 * Per RBI Master Direction on IT Governance 2023 §8.3 and the OWASP
 * ASVS 4.0 V3 session-management requirements, a banking portal
 * MUST enforce the authenticated boundary on the server side. The
 * prior all-client layout did the check from a `useEffect` which is
 * both race-prone and bypassable if the bundle is tampered with.
 *
 * All the client-only machinery (Zustand hydration, session timeout
 * timer, backend-health polling, keyboard navigation, banners,
 * toasts) is wrapped in `./DashboardShell.tsx`. That split lets the
 * shell stay a Client Component while this layout remains server-
 * side.
 */
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/server/session';
import DashboardShell from './DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readSession();
  if (!session) {
    redirect('/login?reason=session_expired');
  }

  return <DashboardShell>{children}</DashboardShell>;
}
