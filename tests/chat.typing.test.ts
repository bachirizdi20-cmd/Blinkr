import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

type TestUser = NonNullable<TrpcContext["user"]>;

function contextFor(id: number): TrpcContext {
  const user: TestUser = {
    id,
    openId: `typing-user-${id}`,
    email: `typing-${id}@example.com`,
    passwordHash: null,
    emailVerifiedAt: null,
    name: `Typing User ${id}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("chat.typing", () => {
  it("exposes typing to the other participant and clears it", async () => {
    const sender = appRouter.createCaller(contextFor(1001));
    const recipient = appRouter.createCaller(contextFor(1002));

    expect(await recipient.social.typing.status({ otherUserId: 1001 })).toEqual({ isTyping: false });
    await sender.social.typing.start({ otherUserId: 1002 });
    expect(await recipient.social.typing.status({ otherUserId: 1001 })).toEqual({ isTyping: true });
    await sender.social.typing.stop({ otherUserId: 1002 });
    expect(await recipient.social.typing.status({ otherUserId: 1001 })).toEqual({ isTyping: false });
  });
});
