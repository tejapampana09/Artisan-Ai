import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { getSession } from "./storage";

export interface SavedAddress {
  id: string;       // string locally (could be numeric from backend)
  backendId?: number; // set when synced with backend
  name: string;
  phone?: string;
  pincode: string;
  addressLine: string;
  city?: string;
  state?: string;
  tag: "HOME" | "WORK" | "OTHER";
  isDefault?: boolean;
}

export const STORAGE_SAVED_ADDRESSES = "artisan_saved_addresses_list";
export const STORAGE_ACTIVE_DELIVERY_ADDRESS = "artisan_saved_delivery_address";

type AddressListener = (addresses: SavedAddress[], activeAddress: SavedAddress | null) => void;
const listeners = new Set<AddressListener>();

export function subscribeAddresses(listener: AddressListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(addresses: SavedAddress[], active: SavedAddress | null) {
  listeners.forEach((fn) => {
    try {
      fn(addresses, active);
    } catch {}
  });
}

/** Map a backend address object to local SavedAddress shape */
function fromBackend(b: any): SavedAddress {
  return {
    id: String(b.id),
    backendId: b.id,
    name: b.name,
    phone: b.phone ?? undefined,
    pincode: b.pincode,
    addressLine: b.address_line,
    city: b.city ?? undefined,
    state: b.state ?? undefined,
    tag: (b.tag as "HOME" | "WORK" | "OTHER") || "HOME",
    isDefault: !!b.is_default,
  };
}

/** Check if the user is logged in to the marketplace */
async function isLoggedIn(): Promise<boolean> {
  try {
    const session = await getSession("MARKETPLACE");
    return !!session?.token;
  } catch {
    return false;
  }
}

// ─── Local cache (AsyncStorage) helpers ─────────────────────────────────────

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_SAVED_ADDRESSES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return [];
}

async function persistLocalAddresses(addresses: SavedAddress[]) {
  await AsyncStorage.setItem(STORAGE_SAVED_ADDRESSES, JSON.stringify(addresses));
}

// ─── Backend-first fetch ─────────────────────────────────────────────────────

/**
 * Refresh local cache from backend (when logged in).
 * Falls back silently to local cache on any error.
 */
export async function refreshAddressesFromBackend(): Promise<SavedAddress[]> {
  try {
    if (!(await isLoggedIn())) return getSavedAddresses();
    const backendList: any[] = await api.getAddresses();
    const mapped = backendList.map(fromBackend);
    await persistLocalAddresses(mapped);
    const active = mapped.find((a) => a.isDefault) || mapped[0] || null;
    if (active) {
      await AsyncStorage.setItem(
        STORAGE_ACTIVE_DELIVERY_ADDRESS,
        `${active.addressLine}${active.pincode ? `, ${active.pincode}` : ""}`
      );
    }
    notifyListeners(mapped, active);
    return mapped;
  } catch {
    return getSavedAddresses();
  }
}

export async function getActiveDeliveryAddress(): Promise<SavedAddress | null> {
  try {
    const addresses = await getSavedAddresses();
    const activeRaw = await AsyncStorage.getItem(STORAGE_ACTIVE_DELIVERY_ADDRESS);

    if (activeRaw) {
      const found = addresses.find(
        (a) =>
          a.addressLine === activeRaw ||
          `${a.addressLine}, ${a.pincode}` === activeRaw ||
          activeRaw.includes(a.pincode)
      );
      if (found) return found;
      if (addresses.length > 0) return addresses[0];
      return {
        id: "active_default",
        name: "You",
        pincode: "",
        addressLine: activeRaw,
        tag: "HOME",
        isDefault: true,
      };
    }

    if (addresses.length > 0) {
      return addresses.find((a) => a.isDefault) || addresses[0];
    }
  } catch {}
  return null;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function saveAddress(
  addr: Omit<SavedAddress, "id"> & { id?: string }
): Promise<SavedAddress[]> {
  const loggedIn = await isLoggedIn();

  // If editing an existing backend address
  if (loggedIn && addr.id && !addr.id.startsWith("addr_")) {
    const bid = Number(addr.id);
    if (!isNaN(bid)) {
      try {
        await api.updateAddress(bid, {
          name: addr.name,
          phone: addr.phone,
          pincode: addr.pincode,
          address_line: addr.addressLine,
          city: addr.city,
          state: addr.state,
          tag: addr.tag,
          is_default: addr.isDefault,
        });
        return refreshAddressesFromBackend();
      } catch {}
    }
  }

  if (loggedIn) {
    try {
      await api.createAddress({
        name: addr.name,
        phone: addr.phone,
        pincode: addr.pincode,
        address_line: addr.addressLine,
        city: addr.city,
        state: addr.state,
        tag: addr.tag || "HOME",
        is_default: addr.isDefault,
      });
      return refreshAddressesFromBackend();
    } catch {}
  }

  // Offline fallback
  const current = await getSavedAddresses();
  const id = addr.id || `addr_${Date.now()}`;
  const newAddr: SavedAddress = {
    ...addr,
    id,
    isDefault: addr.isDefault ?? current.length === 0,
  };

  const existingIndex = current.findIndex((a) => a.id === id);
  let updated: SavedAddress[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = newAddr;
  } else {
    updated = [newAddr, ...current];
  }

  if (newAddr.isDefault) {
    updated = updated.map((a) => ({ ...a, isDefault: a.id === id }));
    await AsyncStorage.setItem(
      STORAGE_ACTIVE_DELIVERY_ADDRESS,
      `${newAddr.addressLine}${newAddr.pincode ? `, ${newAddr.pincode}` : ""}`
    );
  }

  await persistLocalAddresses(updated);
  notifyListeners(updated, newAddr.isDefault ? newAddr : null);
  return updated;
}

export async function selectDeliveryAddress(address: SavedAddress): Promise<void> {
  const loggedIn = await isLoggedIn();
  if (loggedIn && address.backendId) {
    try {
      await api.setDefaultAddress(address.backendId);
      await refreshAddressesFromBackend();
      return;
    } catch {}
  }

  // Offline fallback
  const current = await getSavedAddresses();
  const updated = current.map((a) => ({ ...a, isDefault: a.id === address.id }));
  const addrString = `${address.addressLine}${address.pincode ? `, ${address.pincode}` : ""}`;
  await AsyncStorage.setItem(STORAGE_ACTIVE_DELIVERY_ADDRESS, addrString);
  await persistLocalAddresses(updated);
  notifyListeners(updated, { ...address, isDefault: true });
}

export async function deleteAddress(id: string): Promise<SavedAddress[]> {
  const loggedIn = await isLoggedIn();
  const bid = Number(id);
  if (loggedIn && !isNaN(bid) && !id.startsWith("addr_")) {
    try {
      await api.deleteAddress(bid);
      return refreshAddressesFromBackend();
    } catch {}
  }

  // Offline fallback
  const current = await getSavedAddresses();
  const updated = current.filter((a) => a.id !== id);
  await persistLocalAddresses(updated);
  const active = updated.find((a) => a.isDefault) || updated[0] || null;
  if (active) {
    await AsyncStorage.setItem(
      STORAGE_ACTIVE_DELIVERY_ADDRESS,
      `${active.addressLine}${active.pincode ? `, ${active.pincode}` : ""}`
    );
  } else {
    await AsyncStorage.removeItem(STORAGE_ACTIVE_DELIVERY_ADDRESS);
  }
  notifyListeners(updated, active);
  return updated;
}
