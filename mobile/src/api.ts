import { getSession, AuthDomain } from "./storage";

const DEFAULT_BACKEND_URL = "https://dd8bq7j24onss.cloudfront.net";
const RAW_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_BACKEND_URL).trim();

// Use configured URL or production CloudFront URL
export const BASE_URL = (RAW_URL || DEFAULT_BACKEND_URL).replace(/\/api\/?$/, "").replace(/\/$/, "");

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
  options: RequestInit & { timeoutMs?: number } = {},
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
  const timeoutMs = options.timeoutMs ?? (path.includes("/ai/") ? 90000 : 45000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      if (response.status === 413) {
        detail = "Photo is too large to upload. Please choose a smaller image and try again.";
      } else if (typeof data === "object" && data?.detail) {
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
  // ANALYTICS & EVENTS
  // -------------------------------------------------------------
  async recordEvent(payload: {
    event_type: string;
    product_id?: number;
    category?: string;
    query?: string;
    metadata_info?: string;
  }) {
    try {
      return await request<any>(
        "/events",
        {
          method: "POST",
          body: JSON.stringify(payload)
        },
        "MARKETPLACE"
      );
    } catch {
      return null;
    }
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

  async translateProduct(payload: {
    product_id?: number;
    target_language: string;
    title?: string;
    description?: string;
    craft_story?: string;
  }) {
    return request<any>(
      "/ai/translate-product",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "MARKETPLACE"
    );
  },

  async sellerProduct(id: number) {
    return request<any>(`/products/${id}`, {}, "STUDIO");
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

  async submitProductForReview(id: number) {
    return request<any>(
      `/studio/products/${id}/submit`,
      { method: "POST" },
      "STUDIO"
    );
  },

  // -------------------------------------------------------------
  // AI CATALOG STUDIO
  // -------------------------------------------------------------
  async processCatalog(payload: Record<string, unknown>) {
    try {
      return await request<any>(
        "/ai/process-catalog",
        {
          method: "POST",
          body: JSON.stringify(payload),
          timeoutMs: 180000
        },
        "STUDIO"
      );
    } catch (error) {
      // Some production proxies reject even compressed base64 images. The
      // catalog can still be generated from the verified artisan answers.
      if (error instanceof ApiError && error.status === 413 && payload.image_url) {
        const textOnlyPayload = { ...payload };
        delete textOnlyPayload.image_url;
        return request<any>(
          "/ai/process-catalog",
          {
            method: "POST",
            body: JSON.stringify(textOnlyPayload),
            timeoutMs: 180000
          },
          "STUDIO"
        );
      }
      throw error;
    }
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

  async transcribeAudio(audioUri: string, language: string = "te") {
    const formData = new FormData();
    formData.append("file", {
      uri: audioUri,
      name: "recording.m4a",
      type: "audio/m4a"
    } as any);
    formData.append("language", language);

    return request<{ text: string }>(
      "/ai/transcribe",
      {
        method: "POST",
        body: formData,
        timeoutMs: 30000
      },
      "STUDIO"
    );
  },

  async submitCatalogForApproval(payload: Record<string, unknown>) {
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

  async predictDemand(payload: { product_id: number }) {
    return request<any>("/ml/predict-demand", {
      method: "POST",
      body: JSON.stringify(payload)
    }, "STUDIO");
  },

  async predictProductDemand(productId: number) {
    return request<any>(`/ml/predict-demand/${productId}`, {}, "STUDIO");
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

  async registerPushToken(pushToken: string, domain?: AuthDomain) {
    return request<{ status: string; message: string; user_id?: number }>(
      "/notifications/push-token",
      {
        method: "POST",
        body: JSON.stringify({ push_token: pushToken }),
        headers: { "Content-Type": "application/json" }
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
  // REVIEWS & RATINGS
  // -------------------------------------------------------------
  async productReviews(productId: number) {
    return request<any[]>(`/products/${productId}/reviews`);
  },

  async submitReview(productId: number, payload: { rating: number; comment: string; order_id?: number }) {
    return request<any>(
      `/products/${productId}/reviews`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "MARKETPLACE"
    );
  },

  // -------------------------------------------------------------
  // MARKETPLACE PAYMENTS
  // -------------------------------------------------------------
  async createPayment(payload: { order_id: number; provider?: string; idempotency_key?: string }) {
    return request<any>(
      "/marketplace/payments/create",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      "MARKETPLACE"
    );
  },

  async verifyPayment(payload: {
    order_id: number;
    provider?: string;
    payment_id?: number;
    provider_order_id?: string;
    provider_payment_id?: string;
    signature?: string;
    amount?: number;
    currency?: string;
    idempotency_key?: string;
  }) {
    return request<any>(
      "/marketplace/payments/verify",
      {
        method: "POST",
        body: JSON.stringify({
          provider: "COD",
          ...payload
        })
      },
      "MARKETPLACE"
    );
  },

  // -------------------------------------------------------------
  // TTS (TEXT TO SPEECH) HELPER
  // -------------------------------------------------------------
  getTtsAudioUrl(text: string, lang: string = "te"): string {
    const encodedText = encodeURIComponent(text.trim().slice(0, 300));
    return `${BASE_URL}/api/tts?text=${encodedText}&lang=${lang}`;
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
  },

  // -------------------------------------------------------------
  // DELIVERY ADDRESSES
  // -------------------------------------------------------------
  async getAddresses() {
    return request<any[]>("/marketplace/addresses", {}, "MARKETPLACE");
  },

  async createAddress(payload: {
    name: string;
    phone?: string;
    pincode: string;
    address_line: string;
    city?: string;
    state?: string;
    tag?: string;
    is_default?: boolean;
  }) {
    return request<any>(
      "/marketplace/addresses",
      { method: "POST", body: JSON.stringify(payload) },
      "MARKETPLACE"
    );
  },

  async updateAddress(
    id: number,
    payload: Partial<{
      name: string;
      phone: string;
      pincode: string;
      address_line: string;
      city: string;
      state: string;
      tag: string;
      is_default: boolean;
    }>
  ) {
    return request<any>(
      `/marketplace/addresses/${id}`,
      { method: "PUT", body: JSON.stringify(payload) },
      "MARKETPLACE"
    );
  },

  async setDefaultAddress(id: number) {
    return request<any>(
      `/marketplace/addresses/${id}/default`,
      { method: "POST" },
      "MARKETPLACE"
    );
  },

  async deleteAddress(id: number) {
    return request<null>(
      `/marketplace/addresses/${id}`,
      { method: "DELETE" },
      "MARKETPLACE"
    );
  },

  // -------------------------------------------------------------
  // PAYOUT ACCOUNT (ARTISAN STUDIO)
  // -------------------------------------------------------------
  async getPayoutAccount() {
    return request<any>("/artisan/payout", {}, "STUDIO");
  },

  async updatePayoutAccount(payload: {
    upi_id?: string;
    account_holder_name?: string;
    account_number?: string;
    ifsc_code?: string;
    bank_name?: string;
  }) {
    return request<any>(
      "/artisan/payout",
      { method: "PUT", body: JSON.stringify(payload) },
      "STUDIO"
    );
  },

  // -------------------------------------------------------------
  // CRAFT CLUSTERS & ARTISAN MAP
  // -------------------------------------------------------------
  async getCraftClusters() {
    return request<any[]>("/artisan/map/clusters");
  },

  async getArtisanMapPins(params?: { cluster_id?: string; state?: string; craft?: string }) {
    const query = new URLSearchParams();
    if (params?.cluster_id) query.append("cluster_id", params.cluster_id);
    if (params?.state) query.append("state", params.state);
    if (params?.craft) query.append("craft", params.craft);
    const qs = query.toString();
    return request<any[]>(qs ? `/artisan/map/pins?${qs}` : "/artisan/map/pins");
  },

  async updateArtisanLocation(payload: {
    latitude: number;
    longitude: number;
    craft_cluster?: string;
    state?: string;
    district?: string;
    pincode?: string;
  }) {
    return request<any>(
      "/artisan/location",
      { method: "PUT", body: JSON.stringify(payload) },
      "STUDIO"
    );
  },
};

