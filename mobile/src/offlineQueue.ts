import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const QUEUED_PRODUCTS_KEY = "artisan_offline_queued_products";
const QUEUED_DECISIONS_KEY = "artisan_offline_queued_decisions";
const LAST_SYNC_KEY = "artisan_offline_last_synced_at";

export type SyncState = "ONLINE" | "OFFLINE" | "SYNCING" | "SYNCED" | "FAILED";

export interface QueuedProduct {
  client_temp_id: string;
  client_operation_id: string;
  title: string;
  description?: string;
  craft_story?: string;
  category: string;
  materials?: string;
  price: number;
  stock: number;
  image_url?: string;
  enhanced_image_url?: string;
  material_cost: number;
  labour_cost: number;
  packaging_cost: number;
  other_cost: number;
  min_margin_pct: number;
  created_at_client: string;
}

export interface QueuedDecision {
  product_id: number;
  client_operation_id: string;
  decision: "ACCEPT" | "REJECT";
  recommended_price: number;
  previous_price: number;
  demand_factor: number;
  market_adjustment: number;
  reasoning_summary?: string;
  created_at_client: string;
}

let syncListeners: ((state: SyncState, queueCount: number) => void)[] = [];
let currentSyncState: SyncState = "ONLINE";

export function subscribeSyncState(
  listener: (state: SyncState, queueCount: number) => void
) {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

async function notifySyncChange() {
  const count = await getQueueCount();
  syncListeners.forEach((l) => l(currentSyncState, count));
}

export async function getQueuedProducts(): Promise<QueuedProduct[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUED_PRODUCTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getQueuedDecisions(): Promise<QueuedDecision[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUED_DECISIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getQueueCount(): Promise<number> {
  const [prods, decs] = await Promise.all([getQueuedProducts(), getQueuedDecisions()]);
  return prods.length + decs.length;
}

export async function queueOfflineProduct(
  product: Omit<QueuedProduct, "client_temp_id" | "client_operation_id" | "created_at_client">
): Promise<QueuedProduct> {
  const list = await getQueuedProducts();
  const timestamp = new Date().toISOString();
  const newItem: QueuedProduct = {
    ...product,
    client_temp_id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    client_operation_id: `op_prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at_client: timestamp
  };

  list.push(newItem);
  await AsyncStorage.setItem(QUEUED_PRODUCTS_KEY, JSON.stringify(list));
  await notifySyncChange();
  return newItem;
}

export async function queueOfflineDecision(
  decision: Omit<QueuedDecision, "client_operation_id" | "created_at_client">
): Promise<QueuedDecision> {
  const list = await getQueuedDecisions();
  const timestamp = new Date().toISOString();
  const newItem: QueuedDecision = {
    ...decision,
    client_operation_id: `op_dec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at_client: timestamp
  };

  list.push(newItem);
  await AsyncStorage.setItem(QUEUED_DECISIONS_KEY, JSON.stringify(list));
  await notifySyncChange();
  return newItem;
}

export async function processBatchSync(): Promise<{
  success: boolean;
  syncedCount: number;
  message: string;
}> {
  const [prods, decs] = await Promise.all([getQueuedProducts(), getQueuedDecisions()]);

  if (prods.length === 0 && decs.length === 0) {
    currentSyncState = "SYNCED";
    await notifySyncChange();
    return { success: true, syncedCount: 0, message: "Queue is clean. Everything up to date." };
  }

  currentSyncState = "SYNCING";
  await notifySyncChange();

  try {
    const res = await api.batchSync({
      products: prods,
      price_decisions: decs
    });

    if (res && res.status === "SUCCESS") {
      await AsyncStorage.multiRemove([QUEUED_PRODUCTS_KEY, QUEUED_DECISIONS_KEY]);
      await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      currentSyncState = "SYNCED";
      await notifySyncChange();
      return {
        success: true,
        syncedCount: (res.products_synced?.length || 0) + (res.price_decisions_synced?.length || 0),
        message: `Successfully synchronized ${res.total_items_synced || (prods.length + decs.length)} items.`
      };
    } else {
      currentSyncState = "FAILED";
      await notifySyncChange();
      return { success: false, syncedCount: 0, message: "Sync batch was not confirmed by server." };
    }
  } catch (err: any) {
    currentSyncState = "FAILED";
    await notifySyncChange();
    return {
      success: false,
      syncedCount: 0,
      message: err?.detail || err?.message || "Failed to reach sync server."
    };
  }
}

export const syncOfflineQueue = processBatchSync;

