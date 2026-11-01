import { describe, expect, it } from "vitest";
import { redactPrivateProfile } from "../server/db";
import { storageKeyFromUrl } from "../server/storage";

describe("public profiles", () => {
  const profile = {
    id: 7,
    name: "Private Viewer",
    username: "private_viewer",
    bio: "A bio that should not leak",
    avatarUrl: null,
    isPrivate: true,
  };

  it("keeps legacy profiles public even when the stored privacy flag is true", () => {
    const result = redactPrivateProfile(profile, {
      isFollowing: false,
      isSelf: false,
      followerCount: 12,
      followingCount: 8,
      followsYou: false,
    });

    expect(result.locked).toBe(false);
    expect(result.isPrivate).toBe(false);
    expect(result.bio).toBe(profile.bio);
    expect(result.followerCount).toBe(12);
    expect(result.followingCount).toBe(8);
  });

  it("keeps public profile details visible", () => {
    expect(
      redactPrivateProfile(profile, {
        isFollowing: true,
        isSelf: false,
        followerCount: 12,
        followingCount: 8,
        followsYou: true,
      }),
    ).toMatchObject({
      locked: false,
      bio: profile.bio,
      followerCount: 12,
      followingCount: 8,
    });
  });
});

describe("storage URLs", () => {
  it("extracts only internal storage keys and decodes them", () => {
    expect(storageKeyFromUrl("/manus-storage/avatars/user-7_a%20b.png")).toBe(
      "avatars/user-7_a b.png",
    );
    expect(storageKeyFromUrl("https://images.example.com/avatar.png")).toBeNull();
    expect(storageKeyFromUrl(null)).toBeNull();
  });
});
