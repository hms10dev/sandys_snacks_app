"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";

export async function signOut() {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("pendingProfile");
    } catch (err) {
      console.warn("[useAuth] Unable to clear stored profile data", err);
    }
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  dietary_preferences: string | null;
  role: string | null;
};

type PendingProfile = {
  full_name?: string;
  dietary_preferences?: string | null;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profilePromiseRef = useRef<Promise<void> | null>(null);
  const isMountedRef = useRef(true);

  const handleError = useCallback((message: string, err: unknown) => {
    console.error("[useAuth]", message, err);
    if (!isMountedRef.current) return;
    setError(message);
  }, []);

  const readPendingProfile = useCallback((): PendingProfile | null => {
    try {
      const storedData = localStorage.getItem("pendingProfile");
      if (!storedData) return null;

      localStorage.removeItem("pendingProfile");
      return JSON.parse(storedData) as PendingProfile;
    } catch (err) {
      console.warn("[useAuth] Unable to read pending profile from storage", err);
      return null;
    }
  }, []);

  const loadOrCreateProfile = useCallback(
    async (currentUser: User) => {
      try {
        const {
          data: existingProfile,
          error: selectError,
        } = await supabase
          .from("profiles")
          .select("id, email, full_name, dietary_preferences, role")
          .eq("id", currentUser.id)
          .maybeSingle();

        if (selectError) {
          throw selectError;
        }

        if (existingProfile) {
          if (isMountedRef.current) {
            setProfile(existingProfile as Profile);
            setError(null);
          }
          return;
        }

        const pendingProfile = readPendingProfile();

        const profilePayload = {
          id: currentUser.id,
          email: currentUser.email ?? "",
          full_name:
            pendingProfile?.full_name?.trim() ||
            currentUser.user_metadata?.full_name ||
            currentUser.email?.split("@")[0] ||
            "Snack Lover",
          dietary_preferences:
            pendingProfile?.dietary_preferences ??
            (currentUser.user_metadata?.dietary_preferences as string | null) ??
            null,
        };

        const {
          data: newProfile,
          error: upsertError,
        } = await supabase
          .from("profiles")
          .upsert(profilePayload, { onConflict: "id" })
          .select()
          .single();

        if (upsertError) {
          throw upsertError;
        }

        if (isMountedRef.current) {
          setProfile(newProfile as Profile);
          setError(null);
        }
      } catch (err) {
        handleError(
          "We couldn’t load your profile. Please refresh the page and try again.",
          err
        );
      }
    },
    [handleError, readPendingProfile]
  );

  const syncSession = useCallback(
    async (nextUser: User | null) => {
      if (!isMountedRef.current) return;

      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setError(null);
        return;
      }

      if (profilePromiseRef.current) {
        await profilePromiseRef.current;
        return;
      }

      const profilePromise = loadOrCreateProfile(nextUser);
      profilePromiseRef.current = profilePromise;

      try {
        await profilePromise;
      } finally {
        profilePromiseRef.current = null;
      }
    },
    [loadOrCreateProfile]
  );

  useEffect(() => {
    isMountedRef.current = true;

    const initialiseSession = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        await syncSession(session?.user ?? null);
      } catch (err) {
        handleError(
          "We couldn’t verify your session. Please sign in again.",
          err
        );
        await syncSession(null);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    void initialiseSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!isMountedRef.current) return;
      setLoading(true);
      await syncSession(session?.user ?? null);
      if (isMountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [handleError, syncSession]);

  return {
    user,
    loading,
    profile,
    error,
    isAdmin: profile?.role === "admin",
  };
}
