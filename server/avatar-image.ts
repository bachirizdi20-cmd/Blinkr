import sharp from "sharp";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 20_000_000;
const MAX_BASE64_LENGTH = Math.ceil(MAX_INPUT_BYTES / 3) * 4;
const MAX_OUTPUT_BYTES = 150 * 1024;

export class AvatarImageInputError extends Error {
  constructor(readonly reason: "invalid" | "too_large") {
    super(reason === "too_large" ? "Avatar image is too large" : "Avatar image is invalid");
    this.name = "AvatarImageInputError";
  }
}

/** Validate, decode, crop, resize, and re-encode untrusted avatar data. */
export async function normalizeAvatarDataUri(dataUri: string): Promise<Buffer> {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/_-]+={0,2})$/.exec(dataUri);
  if (!match) throw new AvatarImageInputError("invalid");

  const [, contentType, encoded] = match;
  if (encoded.length > MAX_BASE64_LENGTH || (encoded.includes("=") && !/=+$/.test(encoded))) {
    throw new AvatarImageInputError("too_large");
  }

  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (base64.length % 4 === 1) throw new AvatarImageInputError("invalid");

  const input = Buffer.from(base64, "base64");
  if (input.length > MAX_INPUT_BYTES) throw new AvatarImageInputError("too_large");
  if (!input.length || input.toString("base64").replace(/=+$/, "") !== base64) {
    throw new AvatarImageInputError("invalid");
  }

  const expectedFormat = contentType === "image/jpeg" ? "jpeg" : contentType === "image/png" ? "png" : "webp";
  let metadata;
  try {
    metadata = await sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new AvatarImageInputError("invalid");
  }

  if (
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > MAX_INPUT_PIXELS ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new AvatarImageInputError("invalid");
  }

  const encodings = [
    { size: 512, quality: 80 },
    { size: 512, quality: 72 },
    { size: 384, quality: 72 },
    { size: 256, quality: 64 },
  ];

  try {
    for (const encoding of encodings) {
      const result = await sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(encoding.size, encoding.size, { fit: "cover", position: "centre", withoutEnlargement: true })
        .jpeg({ quality: encoding.quality, mozjpeg: true })
        .toBuffer();
      if (result.byteLength <= MAX_OUTPUT_BYTES) return result;
    }
  } catch {
    throw new AvatarImageInputError("invalid");
  }

  throw new AvatarImageInputError("too_large");
}
