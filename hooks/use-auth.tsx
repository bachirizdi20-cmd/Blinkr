import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { signOutFirebase } from "@/lib/firebaseAuth";
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
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

  const fetchUser = useCallback(async () => {
    console.log("[useAuth] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        const sessionToken = await Auth.getSessionToken();
        if (!sessionToken) {
          console.log("[useAuth] Web: no saved session token; showing sign-in immediately");
          setUser(null);
          await Auth.clearUserInfo();
          return;
        }

        console.log("[useAuth] Web platform: fetching user from API...");
        const apiUser = await Api.getMe();
        console.log("[useAuth] API user response:", apiUser);

        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
          };
          setUser(userInfo);
          // Cache user info in localStorage for faster subsequent loads
          await Auth.setUserInfo(userInfo);
          console.log("[useAuth] Web user set from API:", userInfo);
        } else {
          console.log("[useAuth] Web: No authenticated user from API");
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native platform: use token-based auth
      console.log("[useAuth] Native platform: checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      console.log(
        "[useAuth] Session token:",
        sessionToken ? `present (${sessionToken.substring(0, 20)}...)` : "missing",
      );
      if (!sessionToken) {
        console.log("[useAuth] No session token, setting user to null");
        setUser(null);
        return;
      }

      // Use cached user info for native (token validates the session)
      const cachedUser = await Auth.getUserInfo();
      console.log("[useAuth] Cached user:", cachedUser);
      if (cachedUser) {
        console.log("[useAuth] Using cached user info");
        setUser(cachedUser);
      } else {
        console.log("[useAuth] No cached user, setting user to null");
        setUser(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
      console.log("[useAuth] fetchUser completed, loading:", false);
    }
  }, []);

  const logout = useCallback(async () => {
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
    console.log("[useAuth] useEffect triggered, autoFetch:", autoFetch, "platform:", Platform.OS);
    if (autoFetch) {
      if (Platform.OS === "web") {
        // Web: fetch user from API directly (user will login manually if needed)
        console.log("[useAuth] Web: fetching user from API...");
        fetchUser();
      } else {
        // Native: check for cached user info first for faster initial load
        Auth.getUserInfo().then((cachedUser) => {
          console.log("[useAuth] Native cached user check:", cachedUser);
          if (cachedUser) {
            console.log("[useAuth] Native: setting cached user immediately");
            setUser(cachedUser);
            setLoading(false);
          } else {
            // No cached user, check session token
            fetchUser();
          }
        });
      }
    } else {
      console.log("[useAuth] autoFetch disabled, setting loading to false");
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
