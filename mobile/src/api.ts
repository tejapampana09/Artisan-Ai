import { getSession, AuthDomain } from "./storage";

const RAW_URL = (process.env.EXPO_PUBLIC_API_URL || "https://dd8bq7j24onss.cloudfront.net").trim();
// On physical mobile devices, localhost/127.0.0.1 points to the phone and will fail.
// Auto-resolve to the live CloudFront backend unless a real remote server IP is given.
const CLOUDFRONT_URL = "https://dd8bq7j24onss.cloudfront.net";
const RESOLVED_URL =
  RAW_URL.includes("localhost") || RAW_URL.includes("127.0.0.1")
    ? CLOUDFRONT_URL
    : RAW_URL;
const BASE_URL = RESOLVED_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  domain?: AuthDomain
): Promise<T> {
  if (!BASE_URL) throw new Error("EXPO_PUBLIC_API_URL is not configured.");

  const session = await getSession(domain);
  const token = session.token;
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const url = `${BASE_URL}/api${path}`;
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.status === 204) {
      return null as unknown as T;
    }

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      let detail = "Request failed";
      if (typeof data === "object" && data?.detail) {
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      } else if (typeof data === "string" && data.length > 0) {
        detail = data;
      } else {
        detail = `Server responded with status ${response.status}`;
      }
      throw new ApiError(response.status, String(detail));
    }
    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Network request timed out. Please check your internet connection.");
    }
    throw err;
  }
}

export const api = {
  // -------------------------------------------------------------
  // AUTHENTICATION
  // -------------------------------------------------------------
  async loginSeller(email_or_phone: string, password: string) {
    return request<any>(
      "/studio/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email_or_phone, password })
      },
      "STUDIO"
    );
  },

  async sellerMe() {
    return request<any>("/studio/auth/me", {}, "STUDIO");
  },

  async loginBuyer(email_or_phone: string, password: string) {
    return request<any>(
      "/marketplace/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email_or_phone, password })
      },
      "MARKETPLACE"
    );
  },

  async registerBuyer(payload: Record<string, unknown>) {
    return request<any>(
      "/marketplace/auth/register",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "MARKETPLACE"
    );
  },

  async googleLoginBuyer(payload: {
    access_token?: string;
    token?: string;
    email?: string;
    name?: string;
    google_id?: string;
  }) {
    return request<any>(
      "/marketplace/auth/google",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "MARKETPLACE"
    );
  },

  async buyerMe() {
    return request<any>("/marketplace/auth/me", {}, "MARKETPLACE");
  },

  // -------------------------------------------------------------
  // PRODUCTS
  // -------------------------------------------------------------
  async products(params: string = "") {
    return request<any[]>(`/products${params ? `?${params}` : ""}`);
  },

  async product(id: number) {
    return request<any>(`/products/${id}`);
  },

  async sellerProducts(status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<any[]>(`/products${q}`, {}, "STUDIO");
  },

  async createProduct(payload: Record<string, unknown>) {
    return request<any>(
      "/products",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "STUDIO"
    );
  },

  async updateProduct(id: number, payload: Record<string, unknown>) {
    return request<any>(
      `/products/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload)
      },
      "STUDIO"
    );
  },

  async deleteProduct(id: number) {
    return request<void>(
      `/products/${id}`,
      {
        method: "DELETE"
      },
      "STUDIO"
    );
  },

  // -------------------------------------------------------------
  // AI CATALOG STUDIO
  // -------------------------------------------------------------
  async processCatalog(payload: Record<string, unknown>) {
    return request<any>(
      "/ai/process-catalog",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "STUDIO"
    );
  },

  async enhanceImage(image_url: string, backdrop_id: string = "marble_pedestal") {
    return request<any>(
      "/ai/enhance-image",
      {
        method: "POST",
        body: JSON.stringify({ image_url, backdrop_id })
      },
      "STUDIO"
    );
  },

  async approveCatalog(payload: Record<string, unknown>) {
    return request<any>(
      "/ai/approve-and-publish",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "STUDIO"
    );
  },

  // -------------------------------------------------------------
  // SMART PRICING & MARKET RESEARCH
  // -------------------------------------------------------------
  async priceRecommendation(productId: number) {
    return request<any>(`/products/${productId}/price-recommendation`, {}, "STUDIO");
  },

  async submitPriceDecision(productId: number, decision: "ACCEPT" | "REJECT") {
    return request<any>(
      `/products/${productId}/price-decision`,
      {
        method: "POST",
        body: JSON.stringify({ decision })
      },
      "STUDIO"
    );
  },

  async toggleSmartPricing(productId: number) {
    return request<any>(
      `/products/${productId}/toggle-smart-pricing`,
      {
        method: "PATCH"
      },
      "STUDIO"
    );
  },

  async marketResearch(artisanFacts: Record<string, unknown>) {
    return request<any>(
      "/market/research",
      {
        method: "POST",
        body: JSON.stringify({ artisan_facts: artisanFacts })
      },
      "STUDIO"
    );
  },

  async marketDemand() {
    return request<any>("/market/demand");
  },

  // -------------------------------------------------------------
  // SELLER INTELLIGENCE & COPILOT
  // -------------------------------------------------------------
  async sellerDashboard() {
    return request<any>("/seller/dashboard", {}, "STUDIO");
  },

  async sellerReadiness() {
    return request<any>("/seller/readiness", {}, "STUDIO");
  },

  async sellerOpportunities() {
    return request<any>("/seller/opportunities", {}, "STUDIO");
  },

  async sellerCopilotInsight() {
    return request<any>("/seller/copilot-insight", {}, "STUDIO");
  },

  // -------------------------------------------------------------
  // ML DEMAND FORECAST
  // -------------------------------------------------------------
  async mlModelInfo() {
    return request<any>("/ml/model-info");
  },

  async predictDemand(payload: Record<string, unknown>) {
    return request<any>("/ml/predict-demand", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  // -------------------------------------------------------------
  // ORDERS
  // -------------------------------------------------------------
  async orders(role_view?: "seller" | "buyer") {
    const q = role_view ? `?role_view=${role_view}` : "";
    const domain = role_view === "seller" ? "STUDIO" : "MARKETPLACE";
    return request<any[]>(`/marketplace/orders${q}`, {}, domain);
  },

  async placeOrder(payload: Record<string, unknown>) {
    return request<any>(
      "/marketplace/order",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "MARKETPLACE"
    );
  },

  async updateOrderStatus(orderId: number, status: string) {
    return request<any>(
      `/marketplace/orders/${orderId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status })
      },
      "STUDIO"
    );
  },

  async cancelBuyerOrder(orderId: number) {
    return request<any>(
      `/marketplace/orders/${orderId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELLED" })
      },
      "MARKETPLACE"
    );
  },

  // -------------------------------------------------------------
  // ENQUIRIES
  // -------------------------------------------------------------
  async enquiries(role_view?: "seller" | "buyer") {
    const q = role_view ? `?role_view=${role_view}` : "";
    const domain = role_view === "seller" ? "STUDIO" : "MARKETPLACE";
    return request<any[]>(`/marketplace/enquiries${q}`, {}, domain);
  },

  async sendEnquiry(payload: Record<string, unknown>) {
    return request<any>(
      "/marketplace/enquire",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "MARKETPLACE"
    );
  },

  async replyEnquiry(enquiryId: number, artisanReply: string) {
    return request<any>(
      `/marketplace/enquiries/${enquiryId}/reply`,
      {
        method: "PUT",
        body: JSON.stringify({ artisan_reply: artisanReply })
      },
      "STUDIO"
    );
  },

  // -------------------------------------------------------------
  // BUYER CONCIERGE & RECOMMENDATIONS
  // -------------------------------------------------------------
  async trending() {
    return request<any[]>("/marketplace/trending");
  },

  async recommendations() {
    return request<any[]>("/recommendations", {}, "MARKETPLACE");
  },

  async buyerCopilot(payload: Record<string, unknown>) {
    return request<any>("/buyer/copilot-chat", {
      method: "POST",
      body: JSON.stringify({ language: "en", ...payload })
    });
  },

  // -------------------------------------------------------------
  // SALES CHANNELS & ONDC
  // -------------------------------------------------------------
  async ondcStatus() {
    return request<any>("/ondc/status");
  },

  async salesChannels() {
    return request<any[]>("/channels/list", {}, "STUDIO");
  },

  async publishToChannel(productId: number, channelName: string) {
    return request<any>(
      "/channels/publish",
      {
        method: "POST",
        body: JSON.stringify({ product_id: productId, channel_name: channelName })
      },
      "STUDIO"
    );
  },

  // -------------------------------------------------------------
  // NOTIFICATIONS
  // -------------------------------------------------------------
  async notifications(domain?: AuthDomain) {
    return request<any[]>("/notifications", {}, domain);
  },

  async markNotificationRead(notificationId: number, domain?: AuthDomain) {
    return request<any>(
      `/notifications/${notificationId}/read`,
      {
        method: "POST"
      },
      domain
    );
  },

  // -------------------------------------------------------------
  // ARTISAN PROFILE
  // -------------------------------------------------------------
  async artisanProfile(artisanId: number) {
    return request<any>(`/artisan/${artisanId}`);
  },

  async updateArtisanProfile(payload: Record<string, unknown>) {
    return request<any>(
      "/artisan/profile",
      {
        method: "PUT",
        body: JSON.stringify(payload)
      },
      "STUDIO"
    );
  },

  // -------------------------------------------------------------
  // OFFLINE BATCH SYNC
  // -------------------------------------------------------------
  async syncStatus() {
    return request<any>("/sync/status");
  },

  async batchSync(payload: { products: any[]; price_decisions: any[] }) {
    return request<any>(
      "/sync/batch",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "STUDIO"
    );
  }
};
