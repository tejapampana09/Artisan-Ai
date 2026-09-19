import React from "react";
import { Redirect } from "expo-router";

/**
 * Collections redirect:
 * Per backend architecture and user directive, craft browsing is consolidated
 * directly inside the live marketplace (/buyer) with dynamic category and search filtering,
 * preventing any artificial or unverified catalog collections.
 */
export default function CollectionsScreen() {
  return <Redirect href="/buyer" />;
}