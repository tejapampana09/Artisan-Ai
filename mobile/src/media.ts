/**
 * Converts an image selected on-device into a representation the API can use.
 *
 * Expo image-picker URIs are `file://` paths that exist only on the phone, so
 * they must never be persisted as a product image URL or sent to the AI API.
 */
export interface PickedImageAsset {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
}

export function imageAssetToApiSource(asset: PickedImageAsset): string {
  if (!asset.base64) {
    throw new Error(
      "The photo could not be prepared for upload. Please choose the image again."
    );
  }

  const mimeType = asset.mimeType?.startsWith("image/")
    ? asset.mimeType
    : "image/jpeg";

  return `data:${mimeType};base64,${asset.base64}`;
}
