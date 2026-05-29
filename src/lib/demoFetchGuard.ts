import { DEMO_SCHOOL_ID } from './demo';

/**
 * Frontend defense-in-depth for /demo:
 * Intercepts every request to Supabase's REST/Realtime API and blocks any
 * query that targets a school_id other than the Demo school.
 *
 * The backend already enforces this via RLS (anon role only sees rows where
 * is_demo_school(school_id) = true), but this guard catches accidental
 * cross-tenant queries client-side before they leave the browser.
 */
let installed = false;
let originalFetch: typeof window.fetch | null = null;

function isSupabaseUrl(url: string) {
  return /\/(rest|realtime)\/v1\//.test(url);
}

function violatesDemoScope(url: string): string | null {
  try {
    const u = new URL(url, window.location.origin);
    // PostgREST encodes filters as ?school_id=eq.<uuid> (also in.( ... ), neq., etc.)
    for (const [key, value] of u.searchParams.entries()) {
      if (key !== 'school_id') continue;
      // Allow only eq.<DEMO> or in.(<DEMO>)
      const allowed =
        value === `eq.${DEMO_SCHOOL_ID}` ||
        value === `in.(${DEMO_SCHOOL_ID})` ||
        value === `in.("${DEMO_SCHOOL_ID}")`;
      if (!allowed) return `school_id filter "${value}" is not the Demo school`;
    }
    return null;
  } catch {
    return null;
  }
}

export function installDemoFetchGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (isSupabaseUrl(url)) {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

      // Block any write from /demo — read-only mode.
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        // Allow Supabase auth/storage endpoints (not /rest/v1) — already filtered above.
        console.warn('[DemoGuard] Blocked write request in demo mode:', method, url);
        return new Response(
          JSON.stringify({ message: 'Modo demonstração: gravações estão desativadas.' }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        );
      }

      const violation = violatesDemoScope(url);
      if (violation) {
        console.warn('[DemoGuard] Blocked cross-tenant request:', violation, url);
        return new Response(
          JSON.stringify({ message: `Modo demonstração: ${violation}` }),
          { status: 403, headers: { 'content-type': 'application/json' } },
        );
      }
    }

    return originalFetch!(input, init);
  };
}

export function uninstallDemoFetchGuard() {
  if (!installed || !originalFetch) return;
  window.fetch = originalFetch;
  installed = false;
  originalFetch = null;
}
