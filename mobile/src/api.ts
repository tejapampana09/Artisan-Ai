import { getSession } from "./storage";

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: RequestInit = {}, domain?: "STUDIO" | "MARKETPLACE"): Promise<T> {
  if (!BASE_URL) throw new Error("EXPO_PUBLIC_API_URL is not configured.");

  const session = await getSession();
  const token = session.token;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${BASE_URL}/api${path}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!response.ok) {
      const detail = typeof data === "object" && data?.detail ? data.detail : `Request failed (${response.status})`;
      throw new ApiError(response.status, String(detail));
    }
    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Network request timed out. Please check your connection.");
    }
    throw err;
  }
}

export const api = {
  async loginSeller(email_or_phone: string, password: string) {
    return request<any>("/studio/auth/login", {
      method: "POST",
      body: JSON.stringify({ email_or_phone, password })
    });
  },
  async loginBuyer(email_or_phone: string, password: string) {
    return request<any>("/marketplace/auth/login", {
      method: "POST",
      body: JSON.stringify({ email_or_phone, password })
    });
  },
  async registerBuyer(payload: Record<string, unknown>) {
    return request<any>("/marketplace/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async googleLoginBuyer(payload: { access_token?: string; token?: string; email?: string; name?: string; google_id?: string }) {
    return request<any>("/marketplace/auth/google", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  async products(params = "") {
    return request<any[]>(`/products${params ? `?${params}` : ""}`);
  },
  async product(id: number) {
    return request<any>(`/products/${id}`);
  },
  async sellerProducts() {
    return request<any[]>("/products");
  },
  async createProduct(payload: Record<string, unknown>) {
    return request<any>("/products", { method: "POST", body: JSON.stringify(payload) });
  },
  async processCatalog(payload: Record<string, unknown>) {
    return request<any>("/ai/process-catalog", { method: "POST", body: JSON.stringify(payload) });
  },
  async approveCatalog(payload: Record<string, unknown>) {
    return request<any>("/ai/approve-and-publish", { method: "POST", body: JSON.stringify(payload) });
  },
  async enhanceImage(image_url: string, backdrop_id = "marble_pedestal") {
    return request<any>("/ai/enhance-image", {
      method: "POST",
      body: JSON.stringify({ image_url, backdrop_id })
    });
  },
  async priceRecommendation(id: number) {
    return request<any>(`/products/${id}/price-recommendation`);
  },
  async orders(role_view?: "seller") {
    return request<any[]>(`/marketplace/orders${role_view ? "?role_view=seller" : ""}`);
  },
  async enquiries(role_view?: "seller") {
    return request<any[]>(`/marketplace/enquiries${role_view ? "?role_view=seller" : ""}`);
  },
  async sendEnquiry(payload: Record<string, unknown>) {
    return request<any>("/marketplace/enquire", { method: "POST", body: JSON.stringify(payload) });
  },
  async placeOrder(payload: Record<string, unknown>) {
    return request<any>("/marketplace/order", { method: "POST", body: JSON.stringify(payload) });
  },
  async trending() {
    return request<any[]>("/marketplace/trending");
  },
  async buyerCopilot(payload: Record<string, unknown>) {
    return request<any>("/buyer/copilot-chat", {
      method: "POST",
      body: JSON.stringify({ language: "en", ...payload })
    });
  },
  async ondcStatus() {
    return request<any>("/ondc/status");
  }
};
