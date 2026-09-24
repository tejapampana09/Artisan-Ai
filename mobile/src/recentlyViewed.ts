import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENTLY_VIEWED_KEY = "artisan_mobile_recently_viewed_crafts";
const MAX_RECENT_ITEMS = 12;

export interface RecentlyViewedItem {
  id: number;
  title: string;
  price: number;
  image_url?: string;
  category?: string;
  region_of_origin?: string;
  artisan_name?: string;
  stock?: number;
  viewed_at: number;
}

let listeners: (() => void)[] = [];

export function subscribeRecentlyViewed(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  listeners.forEach((l) => l());
}

export async function getRecentlyViewed(): Promise<RecentlyViewedItem[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addRecentlyViewed(product: any): Promise<void> {
  if (!product || !product.id) return;
  try {
    const list = await getRecentlyViewed();
    const filtered = list.filter((i) => i.id !== Number(product.id));

    const item: RecentlyViewedItem = {
      id: Number(product.id),
      title: product.title || "Handcrafted Heritage Piece",
      price: Number(product.price) || 0,
      image_url: product.enhanced_image_url || product.image_url || undefined,
      category: product.category || "Handicraft",
      region_of_origin: product.region_of_origin || undefined,
      artisan_name: product.artisan_name || product.seller?.name || "Master Artisan",
      stock: product.stock !== undefined ? Number(product.stock) : 1,
      viewed_at: Date.now()
    };

    const updated = [item, ...filtered].slice(0, MAX_RECENT_ITEMS);
    await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
    notifyListeners();
  } catch (e) {
    console.warn("Failed to save recently viewed craft in mobile:", e);
  }
}

export async function removeRecentlyViewed(productId: number): Promise<RecentlyViewedItem[]> {
  try {
    const list = await getRecentlyViewed();
    const filtered = list.filter((i) => i.id !== productId);
    await AsyncStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(filtered));
    notifyListeners();
    return filtered;
  } catch {
    return [];
  }
}

export async function clearRecentlyViewed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENTLY_VIEWED_KEY);
    notifyListeners();
  } catch (e) {
    console.warn("Failed to clear recently viewed crafts:", e);
  }
}
