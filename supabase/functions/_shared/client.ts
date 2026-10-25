/**
 * Google Health API – OAuth und REST-Client.
 *
 * Verifiziert gegen die offizielle Doku (24.10.2026):
 *  - Basis: https://health.googleapis.com/v4, Listen: GET /v4/users/me/dataTypes/{type}/dataPoints
 *  - Query: pageSize (Standard 1440, max. 10000; sleep/exercise: 25), pageToken, filter (AIP-160)
 *  - Antwort: { dataPoints: [...], nextPageToken }
 *  - Rate-Limit: 300 Anfragen/Minute/Nutzer, bei Überschreitung HTTP 429
 *
 * NICHT durch Dokumentation belegt (deshalb konfigurierbar bzw. defensiv umgesetzt):
 *  - Retry-After-Header bei 429 (wird beachtet, falls vorhanden)
 *  - Filter-Feldnamen mehrwortiger Datentypen (snake_case vs. camelCase) → siehe `filterFieldCandidates`
 */

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const HEALTH_BASE = 'https://health.googleapis.com/v4';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function buildAuthUrl(cfg: Pick<OAuthConfig, 'clientId' | 'redirectUri'>, scopes: readonly string[], state: string): string {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    access_type: 'offline', // liefert ein Refresh-Token
    include_granted_scopes: 'false', // nur die hier angeforderten Berechtigungen
    prompt: 'consent', // stellt sicher, dass ein Refresh-Token ausgegeben wird
  });
  return `${GOOGLE_AUTH_URL}?${p.toString()}`;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresInSec: number;
  scopes: string[];
}

export class GoogleApiError extends Error {
  status: number;
  retryable: boolean;
  code?: string;
  constructor(status: number, message: string, retryable = false, code?: string) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.code = code;
  }
}

async function tokenRequest(fetchFn: FetchLike, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetchFn(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof json.error === 'string' ? json.error : undefined;
    // invalid_grant = Refresh-Token widerrufen/abgelaufen → erneute Anmeldung nötig (nicht erneut versuchen)
    throw new GoogleApiError(res.status, `Token-Anfrage fehlgeschlagen (${code ?? res.status})`, res.status >= 500, code);
  }
  return {
    accessToken: String(json.access_token),
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    expiresInSec: Number(json.expires_in ?? 3600),
    scopes: typeof json.scope === 'string' ? json.scope.split(' ').filter(Boolean) : [],
  };
}

export const exchangeCode = (cfg: OAuthConfig, code: string, fetchFn: FetchLike = fetch) =>
  tokenRequest(fetchFn, { code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, grant_type: 'authorization_code' });

export const refreshAccessToken = (cfg: OAuthConfig, refreshToken: string, fetchFn: FetchLike = fetch) =>
  tokenRequest(fetchFn, { refresh_token: refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token' });

export async function revokeToken(token: string, fetchFn: FetchLike = fetch): Promise<boolean> {
  const res = await fetchFn(GOOGLE_REVOKE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }).toString(),
  });
  return res.ok;
}

// ---- Filter-Hilfen ----------------------------------------------------------

const snake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Mögliche Schreibweisen des Feldnamens im Filter. Die Doku zeigt für Filter beide Varianten. */
export function filterFieldCandidates(field: string): string[] {
  const s = snake(field);
  return s === field ? [field] : [s, field];
}

/** Filter für Tageswerte: [fromDate, toDate) */
export const dailyFilter = (field: string, from: string, toExclusive: string) =>
  `${field}.date >= "${from}" AND ${field}.date < "${toExclusive}"`;

/** Filter für Intervalle (Kalenderstart): [fromDate, toDate) */
export const intervalFilter = (field: string, from: string, toExclusive: string) =>
  `${field}.interval.civil_start_time >= "${from}" AND ${field}.interval.civil_start_time < "${toExclusive}"`;

/** Filter für Schlaf über das Aufwach-Datum (civil_end_time). */
export const sleepFilter = (field: string, from: string, toExclusive: string) =>
  `${field}.interval.civil_end_time >= "${from}" AND ${field}.interval.civil_end_time < "${toExclusive}"`;

// ---- REST-Client ------------------------------------------------------------

export interface ClientOptions {
  fetchFn?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  /** Maximale Wiederholungen bei 429/5xx. */
  maxRetries?: number;
  /** Wird bei 401 einmal aufgerufen; liefert ein neues Access-Token. */
  onUnauthorized?: () => Promise<string>;
  /** Obergrenze für Seiten je Abfrage (Schutz vor Endlosschleifen). */
  maxPages?: number;
}

export interface ListParams {
  dataType: string;
  filter?: string;
  pageSize?: number;
}

export class GoogleHealthClient {
  private fetchFn: FetchLike;
  private sleep: (ms: number) => Promise<void>;
  private maxRetries: number;
  private maxPages: number;
  requestCount = 0;
  private accessToken: string;
  private opts: ClientOptions;

  constructor(accessToken: string, opts: ClientOptions = {}) {
    this.accessToken = accessToken;
    this.opts = opts;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = opts.maxRetries ?? 4;
    this.maxPages = opts.maxPages ?? 50;
  }

  /** Exponentieller Backoff mit Jitter; beachtet Retry-After (Sekunden), falls geliefert. */
  static backoffMs(attempt: number, retryAfter: string | null, rand: () => number = Math.random): number {
    const ra = retryAfter ? Number(retryAfter) : NaN;
    if (Number.isFinite(ra) && ra >= 0) return Math.min(ra * 1000, 60_000);
    return Math.min(1000 * 2 ** attempt, 30_000) * (0.5 + rand() * 0.5);
  }

  private async request(url: string): Promise<Response> {
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      this.requestCount++;
      const res = await this.fetchFn(url, { headers: { authorization: `Bearer ${this.accessToken}`, accept: 'application/json' } });
      if (res.ok) return res;
      if (res.status === 401 && !refreshed && this.opts.onUnauthorized) {
        refreshed = true;
        this.accessToken = await this.opts.onUnauthorized();
        continue;
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        await this.sleep(GoogleHealthClient.backoffMs(attempt, res.headers.get('retry-after')));
        continue;
      }
      let msg = `HTTP ${res.status}`;
      let code: string | undefined;
      try {
        const j = (await res.json()) as { error?: { message?: string; status?: string } };
        if (j.error?.message) msg = `${msg}: ${j.error.message}`;
        code = j.error?.status;
      } catch { /* kein JSON */ }
      throw new GoogleApiError(res.status, msg, retryable, code);
    }
  }

  /** Alle Seiten einer Listenabfrage. */
  async listAll(p: ListParams): Promise<Array<Record<string, unknown>>> {
    const out: Array<Record<string, unknown>> = [];
    let pageToken: string | undefined;
    for (let page = 0; page < this.maxPages; page++) {
      const q = new URLSearchParams();
      if (p.filter) q.set('filter', p.filter);
      if (p.pageSize) q.set('pageSize', String(p.pageSize));
      if (pageToken) q.set('pageToken', pageToken);
      const url = `${HEALTH_BASE}/users/me/dataTypes/${p.dataType}/dataPoints?${q.toString()}`;
      const res = await this.request(url);
      const json = (await res.json()) as { dataPoints?: Array<Record<string, unknown>>; nextPageToken?: string };
      out.push(...(json.dataPoints ?? []));
      pageToken = json.nextPageToken || undefined;
      if (!pageToken) return out;
    }
    throw new GoogleApiError(0, `Abbruch: mehr als ${this.maxPages} Seiten für ${p.dataType}`);
  }

  /**
   * Wie listAll, probiert bei HTTP 400 (ungültiger Filter) die alternative Feldnamen-Schreibweise.
   * `build(fieldName)` erzeugt den Filter zum jeweiligen Kandidaten.
   */
  async listWithFilter(dataType: string, field: string, build: (f: string) => string, pageSize?: number): Promise<Array<Record<string, unknown>>> {
    const cands = filterFieldCandidates(field);
    let lastErr: unknown;
    for (const c of cands) {
      try {
        return await this.listAll({ dataType, filter: build(c), pageSize });
      } catch (e) {
        lastErr = e;
        if (!(e instanceof GoogleApiError && e.status === 400)) throw e;
      }
    }
    throw lastErr;
  }
}
