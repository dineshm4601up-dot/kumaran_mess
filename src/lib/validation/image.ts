import "server-only";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, matches the bucket's file_size_limit
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForType(type: string): string {
  return EXTENSION_BY_TYPE[type] ?? "bin";
}

// Sniffs the actual file signature rather than trusting the client-sent
// Content-Type, which is easy to spoof. Returns null if it doesn't match
// any allowed format.
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ImageValidationResult =
  | { ok: true; type: string; bytes: Uint8Array }
  | { ok: false; error: string };

export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  if (file.size === 0) {
    return { ok: false, error: "empty_file" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "file_too_large" };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "unsupported_type" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffedType = sniffImageType(bytes);

  if (!sniffedType || !ALLOWED_IMAGE_TYPES.includes(sniffedType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    // The declared Content-Type looked fine but the actual bytes don't
    // match any supported image format — reject rather than trust the
    // client's label.
    return { ok: false, error: "content_mismatch" };
  }

  return { ok: true, type: sniffedType, bytes };
}
