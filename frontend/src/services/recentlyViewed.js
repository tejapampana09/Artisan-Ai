// Service for managing recently viewed craft items in localStorage

const STORAGE_KEY = 'artisan_ai_recently_viewed_crafts';
const MAX_RECENT_ITEMS = 12;

export function getRecentlyViewedProducts() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to get recently viewed products:', err);
    return [];
  }
}

export function addRecentlyViewedProduct(product) {
  if (typeof window === 'undefined' || !product || !product.id) return;
  try {
    const current = getRecentlyViewedProducts();
    // Exclude existing product to move it to the front
    const filtered = current.filter((p) => p.id !== product.id);
    
    // Store only required fields to keep storage compact & resilient
    const compactProduct = {
      id: product.id,
      title: product.title,
      price: product.price,
      image_url: product.image_url || product.enhanced_image_url,
      enhanced_image_url: product.enhanced_image_url,
      category: product.category,
      region_of_origin: product.region_of_origin,
      artisan_name: product.artisan_name || product.seller?.name,
      stock: product.stock !== undefined ? product.stock : 1,
      seller_id: product.seller_id,
      description: product.description,
      craft_story: product.craft_story,
      viewed_at: Date.now()
    };

    const updated = [compactProduct, ...filtered].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Notify all active listeners across tabs/components
    window.dispatchEvent(new CustomEvent('artisan_recently_viewed_changed', { detail: updated }));
  } catch (err) {
    console.error('Failed to record recently viewed craft:', err);
  }
}

export function removeRecentlyViewedProduct(productId) {
  if (typeof window === 'undefined' || !productId) return;
  try {
    const current = getRecentlyViewedProducts();
    const updated = current.filter((p) => p.id !== productId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('artisan_recently_viewed_changed', { detail: updated }));
  } catch (err) {
    console.error('Failed to remove recently viewed item:', err);
  }
}

export function clearRecentlyViewedProducts() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('artisan_recently_viewed_changed', { detail: [] }));
  } catch (err) {
    console.error('Failed to clear recently viewed crafts:', err);
  }
}
