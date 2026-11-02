import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeAvatarDataUri } from "../server/avatar-image";

describe("profile avatar image sanitization", () => {
  it("decodes and re-encodes a valid image as a square JPEG under the storage limit", async () => {
    const png = await sharp({
      create: { width: 640, height: 800, channels: 3, background: { r: 42, g: 96, b: 148 } },
    }).png().toBuffer();

    const result = await normalizeAvatarDataUri(`data:image/png;base64,${png.toString("base64")}`);
    const metadata = await sharp(result).metadata();

    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(result.byteLength).toBeLessThanOrEqual(150 * 1024);
  });

  it("reduces a detailed image until it fits the database payload limit", async () => {
    const width = 512;
    const height = 512;
    const pixels = Buffer.alloc(width * height * 3);
    let state = 7;
    for (let i = 0; i < pixels.length; i += 1) {
      state = (state * 48271) % 0x7fffffff;
      pixels[i] = state & 0xff;
    }
    const jpeg = await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
    const result = await normalizeAvatarDataUri(`data:image/jpeg;base64,${jpeg.toString("base64")}`);
    const metadata = await sharp(result).metadata();

    expect(result.byteLength).toBeLessThanOrEqual(150 * 1024);
    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.height).toBeLessThanOrEqual(512);
  });

  it("rejects a valid image declared as a different format", async () => {
    const png = await sharp({
      create: { width: 12, height: 12, channels: 3, background: { r: 10, g: 20, b: 30 } },
    }).png().toBuffer();

    await expect(
      normalizeAvatarDataUri(`data:image/jpeg;base64,${png.toString("base64")}`),
    ).rejects.toMatchObject({ reason: "invalid" });
  });

  it("rejects malformed data and encoded payloads larger than the upload limit", async () => {
    await expect(normalizeAvatarDataUri("data:image/jpeg;base64,not-valid-***"))
      .rejects.toMatchObject({ reason: "invalid" });

    const oversized = `data:image/jpeg;base64,${"A".repeat(7_000_000)}`;
    await expect(normalizeAvatarDataUri(oversized))
      .rejects.toMatchObject({ reason: "too_large" });
  });
});
