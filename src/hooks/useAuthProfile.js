import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

export function useAuthProfile({ name, setName }) {
  const [, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const fallbackNameRef = useRef("Spelare");

  useEffect(() => {
    fallbackNameRef.current = name || authName || "Spelare";
  }, [name, authName]);

  const syncProfile = useCallback(async (userId) => {
    if (!userId) return null;
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) {
      setProfile(data);
      if (data.display_name) setName((prev) => prev || data.display_name);
      return data;
    }
    const fallbackName = fallbackNameRef.current || "Spelare";
    const { data: created } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: fallbackName })
      .select("*")
      .single();
    if (created) {
      setProfile(created);
      if (created.display_name) setName((prev) => prev || created.display_name);
      return created;
    }
    return null;
  }, [setName]);

  useEffect(() => {
    let active = true;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const sess = data?.session ?? null;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user?.id) {
        void syncProfile(sess.user.id);
      } else {
        setProfile(null);
      }
    }

    initAuth();
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user?.id) {
        void syncProfile(sess.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      data?.subscription?.unsubscribe?.();
    };
  }, [syncProfile]);

  const handleSignUp = useCallback(async () => {
    setAuthError("");
    if (!authEmail || !authPassword || !authName) {
      setAuthError("Fyll i e-post, lösenord och namn.");
      return;
    }
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return;
    }
    const uid = data?.user?.id;
    if (uid) {
      await supabase.from("profiles").upsert({ id: uid, display_name: authName });
      setProfile({ id: uid, display_name: authName });
      if (!name) setName(authName);
    }
    setAuthLoading(false);
  }, [authEmail, authPassword, authName, name, setName]);

  const handleSignIn = useCallback(async () => {
    setAuthError("");
    if (!authEmail || !authPassword) {
      setAuthError("Fyll i e-post och lösenord.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }, [authEmail, authPassword]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return {
    user,
    profile,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authName,
    setAuthName,
    authError,
    authLoading,
    handleSignUp,
    handleSignIn,
    handleSignOut,
  };
}
