import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY = "artisan_mobile_cart_items";

export interface CartItem {
  id: number;
  title: string;
  price: number;
  image_url?: string;
  category?: string;
  quantity: number;
}

let cartListeners: (() => void)[] = [];

export function subscribeCart(listener: () => void) {
  cartListeners.push(listener);
  return () => {
    cartListeners = cartListeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  cartListeners.forEach((l) => l());
}

export async function getCart(): Promise<CartItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addToCart(product: any, qty = 1): Promise<CartItem[]> {
  const cart = await getCart();
  const existingIndex = cart.findIndex((i) => i.id === product.id);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += qty;
  } else {
    cart.push({
      id: product.id,
      title: product.title || "Handcrafted Craft",
      price: Number(product.price) || 0,
      image_url: product.enhanced_image_url || product.image_url || undefined,
      category: product.category || "Handmade",
      quantity: qty
    });
  }

  await AsyncStorage.setItem(CART_KEY, JSON.stringify(cart));
  notifyListeners();
  return cart;
}

export async function updateQuantity(id: number, delta: number): Promise<CartItem[]> {
  const cart = await getCart();
  const item = cart.find((i) => i.id === id);
  if (item) {
    item.quantity += delta;
    if (item.quantity <= 0) {
      return removeFromCart(id);
    }
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(cart));
    notifyListeners();
  }
  return cart;
}

export async function removeFromCart(id: number): Promise<CartItem[]> {
  const cart = await getCart();
  const filtered = cart.filter((i) => i.id !== id);
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(filtered));
  notifyListeners();
  return filtered;
}

export async function clearCart(): Promise<void> {
  await AsyncStorage.removeItem(CART_KEY);
  notifyListeners();
}

export async function getCartCount(): Promise<number> {
  const cart = await getCart();
  return cart.reduce((total, item) => total + item.quantity, 0);
}
