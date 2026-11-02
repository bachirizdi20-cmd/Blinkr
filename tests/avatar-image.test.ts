import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeAvatarDataUri } from "../server/avatar-image";

describe("profile avatar image sanitization", () => {
  it("decodes and re-encodes a valid image as a square JPEG", async () => {
    const png = await sharp({
      create: { width: 640, height: 800, channels: 3, background: { r: 42, g: 96, b: 148 } },
    }).png().toBuffer();

    const result = await normalizeAvatarDataUri(`data:image/png;base64,${png.toString("base64")}`);
    const metadata = await sharp(result).metadata();

    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
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
