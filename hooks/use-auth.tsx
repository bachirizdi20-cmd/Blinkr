import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { signOutFirebase } from "@/lib/firebaseAuth";
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type UseAuthOptions = {
  autoFetch?: boolean;
};

type AuthState = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function useAuthController(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestVersion = useRef(0);

  const fetchUser = useCallback(async () => {
    const version = ++requestVersion.current;
    let sessionToken: string | null = null;
    let cachedUser: Auth.User | null = null;
    try {
      setLoading(true);
      setError(null);
      sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        await Auth.clearUserInfo();
        if (version !== requestVersion.current) return;
        setUser(null);
        return;
      }

      cachedUser = await Auth.getUserInfo();
      if (version !== requestVersion.current) return;
      if (cachedUser) setUser(cachedUser);

      // A cached profile is only a display fallback; the API must validate the
      // stored session before the protected parts of the app are unlocked.
      const apiUser = await Api.getMe();
      if (version !== requestVersion.current) return;
      if (!apiUser) {
        await Auth.removeSessionToken();
        await Auth.clearUserInfo();
        if (version !== requestVersion.current) return;
        setUser(null);
        return;
      }

      const userInfo: Auth.User = {
        id: apiUser.id,
        openId: apiUser.openId,
        name: apiUser.name,
        email: apiUser.email,
        loginMethod: apiUser.loginMethod,
        lastSignedIn: new Date(apiUser.lastSignedIn),
      };
      setUser(userInfo);
      await Auth.setUserInfo(userInfo);
    } catch (err) {
      if (version !== requestVersion.current) return;
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] Session validation failed:", error);
      setError(error);
      // Keep an already authenticated account usable offline if its secure
      // token is present; a 401 is handled separately above and clears it.
      if (sessionToken && cachedUser) setUser(cachedUser);
      else setUser(null);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    requestVersion.current += 1;
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
      // Continue with logout even if API call fails
    } finally {
      try {
        await signOutFirebase();
      } catch (err) {
        console.error("[Auth] Firebase logout failed:", err);
      }
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (autoFetch) {
      void fetchUser();
    } else {
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  useEffect(() => {
    console.log("[useAuth] State updated:", {
      hasUser: !!user,
      loading,
      isAuthenticated,
      error: error?.message,
    });
  }, [user, loading, isAuthenticated, error]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthController();
  const queryClient = useQueryClient();
  const currentOpenId = auth.user?.openId ?? null;
  const [cacheOpenId, setCacheOpenId] = useState(currentOpenId);

  useLayoutEffect(() => {
    if (cacheOpenId === currentOpenId) return;
    // Private tRPC results are cached by query input, not by the active user.
    // Hide children until the old cache is cleared, so it cannot flash on screen.
    queryClient.clear();
    setCacheOpenId(currentOpenId);
  }, [cacheOpenId, currentOpenId, queryClient]);

  return React.createElement(
    AuthContext.Provider,
    { value: auth },
    cacheOpenId === currentOpenId ? children : null,
  );
}

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used within AuthProvider");
  return auth;
}
