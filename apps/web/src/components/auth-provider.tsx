"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthenticatedPrincipal } from "@saas/types";
import type { MeResponse } from "@saas/contracts";
import {
  ApiClientAbortedError,
  broadcastLogin,
  broadcastLogout,
  onLoginBroadcast,
  onLogoutBroadcast,
} from "@saas/api-client";
import { apiClient } from "../lib/api-client";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface AuthState {
  status: AuthStatus;
  principal: AuthenticatedPrincipal | null;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  /** Re-fetches /auth/me and updates state. Call after any action that
   * changes the session server-side but doesn't itself navigate (e.g. OTP
   * verify) — login/signup pages that already `router.push()` afterward
   * don't need this, since the destination page re-resolves the session on
   * the server (checklist "profile fetched only after the session is
   * confirmed" applies the same way: this never runs the profile fetch
   * itself, it just updates `principal`). */
  refresh: () => Promise<void>;
  /** Call right after a successful login/OTP/magic-link verification in
   * THIS tab (which, like login, returns no principal in its own response
   * body — cookies only). Re-resolves the session via `refresh()` and
   * broadcasts to every other open tab so a login form left open elsewhere
   * also notices (cross-tab login sync, checklist task 3). */
  notifyLoggedIn: () => Promise<void>;
  /** Calls POST /auth/logout, clears every registered cache (see
   * `useClearOnLogout`), clears this tab's own state, and broadcasts to
   * every other open tab so they drop out of their own authenticated views
   * too (checklist "logout clears every client cache" / "cross-tab sync for
   * logout"). Never throws — a failed logout request still clears local
   * state, since staying on a page the server no longer recognizes a
   * session for is strictly worse than a client state that's briefly ahead
   * of the server's. */
  logout: () => Promise<void>;
  /** Registers a callback to run on logout (this tab's own logout, or
   * another tab's, via cross-tab sync) — e.g. a page holding a list of
   * sessions/connected accounts clears it rather than showing stale,
   * post-logout data if the user signs back in as someone else. Returns an
   * unsubscribe function. */
  registerClearOnLogout: (fn: () => void) => () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({
  initialPrincipal,
  children,
}: {
  initialPrincipal: AuthenticatedPrincipal | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // The server already resolved the session before this component ever
  // rendered (see apps/web/src/lib/session.ts + the root layout) — so the
  // initial status is NEVER "loading". This is what prevents both a flash
  // of protected content (an unauthenticated visitor never briefly sees
  // "authenticated" UI while a client fetch is in flight) and a flash of
  // the login page for an already-authenticated user (checklist items 24,
  // 25) — there is no client-only round trip standing between first paint
  // and knowing the real auth state.
  const [state, setState] = useState<AuthState>({
    status: initialPrincipal ? "authenticated" : "unauthenticated",
    principal: initialPrincipal,
    error: null,
  });

  // A monotonically increasing counter, bumped on every login/logout/user
  // change. Any in-flight /auth/me response tags itself with the generation
  // it started under; if that generation is stale by the time the response
  // arrives (the user logged out, or a DIFFERENT user logged in, in the
  // meantime), the response is dropped rather than applied — checklist task
  // 2: "a session generation counter... drop responses that arrive after
  // logout or user change."
  const generationRef = useRef(0);
  const clearCallbacksRef = useRef(new Set<() => void>());
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await apiClient.get<MeResponse>("/auth/me", { signal: controller.signal });
      if (generationRef.current !== generation) return; // stale — dropped
      setState({ status: "authenticated", principal: res.principal, error: null });
    } catch (err) {
      if (err instanceof ApiClientAbortedError) return; // cancelled on purpose
      if (generationRef.current !== generation) return; // stale — dropped
      setState({ status: "unauthenticated", principal: null, error: null });
    }
  }, []);

  const runClearCallbacks = useCallback(() => {
    for (const fn of clearCallbacksRef.current) fn();
  }, []);

  const logout = useCallback(async () => {
    generationRef.current++;
    abortRef.current?.abort();
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // See the doc comment above `logout` on AuthContextValue — a failed
      // logout request still clears local state unconditionally below.
    }
    runClearCallbacks();
    setState({ status: "unauthenticated", principal: null, error: null });
    broadcastLogout();
  }, [runClearCallbacks]);

  const notifyLoggedIn = useCallback(async () => {
    await refresh();
    broadcastLogin();
  }, [refresh]);

  const registerClearOnLogout = useCallback((fn: () => void) => {
    clearCallbacksRef.current.add(fn);
    return () => clearCallbacksRef.current.delete(fn);
  }, []);

  // Cross-tab sync (checklist task 3): another tab logging out clears THIS
  // tab's state and caches too, rather than leaving a stale authenticated
  // view up until this tab's own next navigation. Another tab logging in
  // makes this tab re-resolve its own session — relevant e.g. when a login
  // form was left open in tab B while the user completed login in tab A.
  useEffect(() => {
    const unsubLogout = onLogoutBroadcast(() => {
      generationRef.current++;
      runClearCallbacks();
      setState({ status: "unauthenticated", principal: null, error: null });
      router.refresh();
    });
    const unsubLogin = onLoginBroadcast(() => {
      void refresh();
    });
    return () => {
      unsubLogout();
      unsubLogin();
    };
  }, [refresh, router, runClearCallbacks]);

  return (
    <AuthContext.Provider
      value={{ ...state, refresh, notifyLoggedIn, logout, registerClearOnLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
