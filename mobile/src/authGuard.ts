import { useCallback } from "react";
import { useFocusEffect, router } from "expo-router";
import { enforceRoleBoundary } from "./storage";

/**
 * Hook to enforce strict view and role isolation:
 * - "seller": Requires authenticated ARTISAN/ADMIN. Auto-logouts buyer session. Redirects to /login?role=seller if unauthorized.
 * - "buyer": Auto-logouts active seller studio session when entering buyer view.
 */
export function useRoleGuard(targetRole: "seller" | "buyer") {
  useFocusEffect(
    useCallback(() => {
      enforceRoleBoundary(targetRole, router);
    }, [targetRole])
  );
}
