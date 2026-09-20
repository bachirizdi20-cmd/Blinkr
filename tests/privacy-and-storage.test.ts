import { describe, expect, it } from "vitest";
import { redactPrivateProfile } from "../server/db";
import { storageKeyFromUrl } from "../server/storage";

describe("private profiles", () => {
  const profile = {
    id: 7,
    name: "Private Viewer",
    username: "private_viewer",
    bio: "A bio that should not leak",
    avatarUrl: null,
    isPrivate: true,
  };

  it("hides private profile details from a non-follower", () => {
    const result = redactPrivateProfile(profile, {
      isFollowing: false,
      isSelf: false,
      followerCount: 12,
      followingCount: 8,
      followsYou: false,
    });

    expect(result.locked).toBe(true);
    expect(result.bio).toBeNull();
    expect(result.followerCount).toBeNull();
    expect(result.followingCount).toBeNull();
  });

  it("reveals details to the owner or an approved follower", () => {
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
