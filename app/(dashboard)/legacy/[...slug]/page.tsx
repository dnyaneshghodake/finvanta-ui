'use client';

/**
 * FINVANTA Legacy JSP Bridge.
 *
 * Renders the existing Spring MVC / JSP screens inside a same-origin
 * iframe so operators have uninterrupted access to flows that are not
 * yet migrated to React (CIF, FD booking, EOD, reports, admin, etc.).
 *
 * The iframe is served through the BFF reverse proxy at `/legacy/**`
 * so the JSP session and the Next.js BFF session share the same
 * top-level origin -- cookies, CSRF, and audit correlation are
 * unbroken. We do NOT embed the Spring server's external URL, which
 * would break cookie SameSite and CSP.
 */

import { useParams, useSearchParams } from 'next/navigation';

export default function LegacyBridgePage() {
  const params = useParams<{ slug?: string[] }>();
  const search = useSearchParams();
  const slug = (params?.slug || []).join('/');
  const qs = search.toString();
  const src = `/legacy/${slug}${qs ? `?${qs}` : ''}`;

  return (
    <div className="h-[calc(100vh-96px)] flex flex-col">
      <div className="cbs-surface-header">
        <div className="text-sm font-semibold uppercase tracking-wider text-cbs-steel-700">
          Legacy screen: {slug || 'home'}
        </div>
        <span className="cbs-ribbon text-cbs-violet-700 bg-cbs-violet-50">
          JSP bridge
        </span>
      </div>
      <iframe
        title={`Legacy: ${slug}`}
        src={src}
        className="flex-1 w-full border-x border-b border-cbs-steel-200 bg-white"
        sandbox="allow-same-origin allow-forms allow-scripts allow-popups"
      />
    </div>
  );
}
