import { CLINICAL_DOSING_DATABASE, DosingMedication } from '../data/medicineData';

export interface SupabaseHistoryItem {
  id: string;
  type: 'identify' | 'disease' | 'generic' | 'dosing' | 'history';
  query: string;
  result: string;
  user_email?: string;
  timestamp: number;
}

/**
 * Client-side mock context check to trigger synchronized states.
 * Under full-stack execution, sync logic is proxied securely in the node tier.
 */
export function getSupabaseClient(): any {
  return true;
}

/**
 * Saves a clinical audit log to Supabase via server-side proxy.
 */
export async function saveHistoryLogToSupabase(
  type: string,
  query: string,
  result: string,
  userEmail?: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/pharma/supabase/history/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type,
        query,
        result,
        email: userEmail || null
      })
    });
    if (!res.ok) {
      console.warn("[Supabase Proxy Client] Save history responded with non-2xx status");
      return false;
    }
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error("[Supabase Proxy Client] Save history exception:", err);
    return false;
  }
}

/**
 * Re-hydrates clinical logs from the Supabase history database via server-side proxy.
 */
export async function fetchHistoryLogsFromSupabase(userEmail?: string): Promise<SupabaseHistoryItem[]> {
  try {
    const url = userEmail 
      ? `/api/pharma/supabase/history?email=${encodeURIComponent(userEmail)}`
      : `/api/pharma/supabase/history`;
    
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[Supabase Proxy Client] Fetch history responded with non-2xx status");
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error("[Supabase Proxy Client] Fetch history exception:", err);
    return [];
  }
}

/**
 * Pulls custom clinical medications from Supabase via server-side proxy or returns fallback.
 */
export async function fetchMedicinesFromSupabase(): Promise<DosingMedication[]> {
  try {
    const res = await fetch("/api/pharma/supabase/medicines");
    if (!res.ok) {
      console.warn("[Supabase Proxy Client] Fetch medicines responded with non-2xx status. Falling back.");
      return CLINICAL_DOSING_DATABASE;
    }
    return await res.json();
  } catch (err) {
    console.error("[Supabase Proxy Client] Fetch medicines exception:", err);
    return CLINICAL_DOSING_DATABASE;
  }
}

/**
 * Handles Google OAuth Sign-in proxy emulation
 */
export async function signInWithGoogle() {
  // Signs in as the active viewer email directly on click
  const defaultGmail = "jamilsagorwork@gmail.com";
  localStorage.setItem("clinical_user_email", defaultGmail);
  return { user: { email: defaultGmail } };
}

/**
 * Handles Email/Password Standard Sign-up via server-side proxy
 */
export async function signUpWithEmail(email: string, pass: string) {
  const res = await fetch("/api/pharma/supabase/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password: pass })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Medical registration refused.");
  }
  return await res.json();
}

/**
 * Handles Email/Password Standard Log-in via server-side proxy
 */
export async function signInWithEmail(email: string, pass: string) {
  const res = await fetch("/api/pharma/supabase/signin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password: pass })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || "Authentication credentials refused.");
  }
  const data = await res.json();
  if (data.user?.email) {
    localStorage.setItem("clinical_user_email", data.user.email);
  }
  return data;
}

/**
 * Signs out the currently authenticated user session
 */
export async function signOutUser() {
  localStorage.removeItem("clinical_user_email");
}

/**
 * Returns the currently active authenticated session user's email if logged in
 */
export async function getActiveUserEmail(): Promise<string | null> {
  return localStorage.getItem("clinical_user_email");
}
