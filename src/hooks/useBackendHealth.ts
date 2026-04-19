/**
 * Polls the BFF health endpoint (`GET /api/cbs/health`) to detect
 * when the Spring backend goes down. Returns `backendStatus` which
 * the dashboard layout uses to show/hide a maintenance banner.
 *
 * Polling interval: 30 seconds (matches the session heartbeat cadence).
 * The hook is intentionally resilient — if the BFF itself is down,
 * the fetch silently fails and the status stays at the last known
 * value (or "UNKNOWN" on first load).
 *
 * This does NOT replace the session heartbeat — it is a separate
 * concern: "is the banking server reachable?" vs "is my session
 * still valid?".
 */
import { useEffect, useRef, useState } from "react";

export type BackendStatus = "UP" | "DOWN" | "UNKNOWN";

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useBackendHealth(enabled = true) {
  const [status, setStatus] = useState<BackendStatus>("UNKNOWN");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const check = async () => {
      try {
        const res = await fetch("/api/cbs/health", {
          method: "GET",
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          const bs = json?.data?.backendStatus;
          setStatus(bs === "UP" ? "UP" : bs === "DOWN" ? "DOWN" : "UNKNOWN");
          setCheckedAt(json?.data?.checkedAt ?? new Date().toISOString());
        } else {
          setStatus("DOWN");
        }
      } catch {
        // BFF itself is unreachable — treat as unknown (could be
        // a transient network blip on the operator's side).
        setStatus("UNKNOWN");
      }
    };

    // Initial check immediately.
    void check();

    // Then poll every 30 seconds.
    timerRef.current = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled]);

  return { backendStatus: status, checkedAt };
}
