// Server-only REST contract: docs.tectly.com/pages/getting-started/authentication.html
if (typeof window !== "undefined") throw new Error("Tectly credentials belong on the server.");

export class TectlyError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 502) { super(message); this.code = code; this.status = status; }
}
export function tectlyConfig(env: Record<string, string | undefined> = process.env) {
  const clientPair = Boolean(env.TECTLY_CLIENT_ID?.trim() || env.TECTLY_CLIENT_SECRET?.trim());
  const clientId = ((clientPair ? env.TECTLY_CLIENT_ID : env.TECTLY_API_KEY) || "").trim();
  const clientSecret = ((clientPair ? env.TECTLY_CLIENT_SECRET : env.TECTLY_API_SECRET) || "").trim();
  const disabled = env.TECTLY_DISABLED?.trim().toLowerCase() === "true";
  const base = (env.TECTLY_API_BASE_URL || "https://platform.tectly.com/api/v1").trim().replace(/\/+$/, "");
  const validBase = ["https://platform.tectly.com/api/v1", "https://sandbox.platform.tectly.com/api/v1"].includes(base);
  return { clientId, clientSecret, disabled, base, validBase, configured: Boolean(clientId && clientSecret && !disabled && validBase) };
}
export class TectlyClient {
  private config: ReturnType<typeof tectlyConfig>;
  private fetcher: typeof fetch;
  private token = "";
  private expires = 0;
  private authentication: Promise<void> | null = null;
  constructor(config = tectlyConfig(), fetcher: typeof fetch = fetch) { this.config = config; this.fetcher = fetcher; }
  private async exchange(endpoint: string, init: RequestInit) {
    let response: Response;
    try { response = await this.fetcher(this.config.base + endpoint, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) }); }
    catch { throw new TectlyError("connection", "تعذر الاتصال بالقارئ الإضافي. حاول استكمال القراءة لاحقًا."); }
    if (!response.ok) {
      const status = response.status;
      // Provider bodies and authorization headers never leave this boundary.
      throw new TectlyError(`http_${status}`, status === 401 || status === 403 ? "بيانات الاتصال بالقارئ الإضافي غير مقبولة. راجع إعدادها على الخادم." : status === 402 || status === 429 ? "تعذرت القراءة بسبب الرصيد أو حد الاستخدام لدى القارئ الإضافي." : "لم يتمكن القارئ الإضافي من إكمال الطلب.");
    }
    try { return await response.json(); } catch { throw new TectlyError("invalid_response", "وصلت نتيجة غير مكتملة من القارئ الإضافي."); }
  }
  async authenticate() {
    if (!this.config.configured) throw new TectlyError("not_configured", "القارئ الإضافي غير مفعّل. تحقق من متغيرات الاتصال.", 503);
    if (this.token && this.expires > Date.now() + 60000) return;
    if (!this.authentication) this.authentication = (async () => {
      const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");
      const data = await this.exchange("/issue-authentication-token", { method: "POST", headers: { Authorization: `Basic ${basic}`, Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
      if (typeof data?.token !== "string" || !data.token) throw new TectlyError("invalid_auth", "لم يصدر رمز اتصال صالح من القارئ الإضافي.");
      this.token = data.token;
      const expiry = Date.parse(data.expiryDate);
      this.expires = Number.isFinite(expiry) ? expiry : Date.now() + 300000;
    })().finally(() => { this.authentication = null; });
    await this.authentication;
  }
  async request(endpoint: string, init: RequestInit = {}) {
    await this.authenticate();
    const call = () => this.exchange(endpoint, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${this.token}`, Accept: "application/json" } });
    try { return await call(); }
    catch (error) {
      // Only retry reads after token expiration. Mutations are never replayed.
      if (error instanceof TectlyError && error.code === "http_401" && (!init.method || init.method === "GET")) {
        this.token = ""; await this.authenticate(); return call();
      }
      throw error;
    }
  }
  createProject(id: string, title: string) { return this.request("/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, title }) }); }
  addDocument(projectId: string, bytes: Buffer, name: string, mime: string) {
    const form = new FormData();
    form.set("document", new Blob([new Uint8Array(bytes)], { type: mime }), name);
    return this.request(`/projects/${encodeURIComponent(projectId)}/documents`, { method: "POST", body: form });
  }
}
let client: TectlyClient | undefined;
export function getTectlyClient() { return client ||= new TectlyClient(); }
