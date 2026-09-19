import AsyncStorage from "@react-native-async-storage/async-storage";

const WISHLIST_KEY = "artisan_mobile_wishlist_items";

export interface WishlistItem {
  id: number;
  title: string;
  price: number;
  image_url?: string;
  category?: string;
  artisan_name?: string;
  saved_at: string;
}

let wishlistListeners: (() => void)[] = [];

export function subscribeWishlist(listener: () => void) {
  wishlistListeners.push(listener);
  return () => {
    wishlistListeners = wishlistListeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  wishlistListeners.forEach((l) => l());
}

export async function getWishlist(): Promise<WishlistItem[]> {
  try {
    const raw = await AsyncStorage.getItem(WISHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function isWishlisted(productId: number): Promise<boolean> {
  const list = await getWishlist();
  return list.some((i) => i.id === productId);
}

export async function toggleWishlist(product: any): Promise<boolean> {
  const list = await getWishlist();
  const existingIndex = list.findIndex((i) => i.id === product.id);

  if (existingIndex > -1) {
    list.splice(existingIndex, 1);
    await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    notifyListeners();
    return false; // Removed
  } else {
    list.push({
      id: product.id,
      title: product.title || "Handcrafted Heritage Piece",
      price: Number(product.price) || 0,
      image_url: product.enhanced_image_url || product.image_url || undefined,
      category: product.category || "Handmade",
      artisan_name: product.artisan_name || "Verified Artisan",
      saved_at: new Date().toISOString()
    });
    await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
    notifyListeners();
    return true; // Added
  }
}

export async function removeFromWishlist(productId: number): Promise<WishlistItem[]> {
  const list = await getWishlist();
  const filtered = list.filter((i) => i.id !== productId);
  await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(filtered));
  notifyListeners();
  return filtered;
}

export async function clearWishlist(): Promise<void> {
  await AsyncStorage.removeItem(WISHLIST_KEY);
  notifyListeners();
}
