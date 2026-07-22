import { getSupabaseClient } from './supabaseClient.js';

let currentUser = null;
let authChangeCallback = null;

export function getCurrentUser() {
  return currentUser;
}

function notifyAuthStateChange(user) {
  currentUser = user;
  renderAuthUI(user);
  if (typeof authChangeCallback === 'function') {
    authChangeCallback(user);
  }
}

export async function initAuth(onUserChangeCallback) {
  if (typeof onUserChangeCallback === 'function') {
    authChangeCallback = onUserChangeCallback;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log("[Auth] Supabase is not configured yet.");
    notifyAuthStateChange(null);
    return;
  }

  // Get current active session
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      notifyAuthStateChange(session.user);
    } else {
      notifyAuthStateChange(null);
    }
  } catch (e) {
    console.warn("[Auth] Failed to get session:", e);
    notifyAuthStateChange(null);
  }

  // Listen for auth state changes (login, logout)
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log(`[Auth State Change] Event: ${event}`);
    const user = session?.user || null;

    if (event === 'SIGNED_IN' && user) {
      notifyAuthStateChange(user);
    } else if (event === 'SIGNED_OUT' || !user) {
      notifyAuthStateChange(null);
    }
  });

  setupAuthEventListeners();
}

export async function signInWithGoogle() {
  console.log("[Auth Debug] Google Login button clicked!");
  const supabase = getSupabaseClient();
  if (!supabase) {
    alert("Supabase 클라우드 연결 설정이 필요합니다. (local.env / 환경변수 확인)");
    return;
  }

  try {
    const redirectUrl = "https://desktopschedule.pages.dev/";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true
      }
    });

    if (error) {
      console.error("[Auth Error] Google sign-in failed:", error.message);
      alert(`로그인 실패: ${error.message}`);
      return;
    }

    if (data?.url) {
      console.log("[Auth] Opening Google OAuth URL:", data.url);

      if (window.electronAPI && typeof window.electronAPI.openAuthWindow === 'function') {
        const tokens = await window.electronAPI.openAuthWindow(data.url);
        if (tokens && tokens.access_token && tokens.refresh_token) {
          console.log("[Auth] Electron session tokens captured! Setting session...");
          const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token
          });

          if (!sessionErr && sessionData?.user) {
            notifyAuthStateChange(sessionData.user);
            window.location.reload();
          }
        }
      } else {
        window.location.href = data.url;
      }
    }
  } catch (err) {
    console.error("[Auth System Error]", err);
    alert(`로그인 시스템 오류: ${err.message}`);
  }
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Auth Signout Error]", err);
    }
  }
  
  // Clean up cached events of the logged-out user
  localStorage.removeItem("desktop_scheduler_events");
  
  // Instantly notify calendar and components to lock UI with overlays
  notifyAuthStateChange(null);
}

function setupAuthEventListeners() {
  const loginBtn = document.getElementById("google-login-btn");
  const logoutBtn = document.getElementById("auth-logout-btn");

  if (loginBtn) {
    loginBtn.onclick = (e) => {
      if (e) e.preventDefault();
      signInWithGoogle();
    };
  }
  if (logoutBtn) {
    logoutBtn.onclick = (e) => {
      if (e) e.preventDefault();
      signOut();
    };
  }
}

// Bind to window global for guaranteed inline/direct calls
if (typeof window !== 'undefined') {
  window.signInWithGoogle = signInWithGoogle;
  window.signOut = signOut;
}

function renderAuthUI(user) {
  const loginBtn = document.getElementById("google-login-btn");
  const userProfile = document.getElementById("user-profile-container");
  const userEmail = document.getElementById("user-email-label");
  const userAvatar = document.getElementById("user-avatar-img");

  if (user) {
    if (loginBtn) loginBtn.style.display = "none";
    if (userProfile) userProfile.style.display = "inline-flex";
    if (userEmail) {
      const email = user.email || user.user_metadata?.full_name || "사용자";
      userEmail.textContent = email.length > 18 ? email.substring(0, 16) + "..." : email;
    }
    if (userAvatar) {
      userAvatar.src = user.user_metadata?.avatar_url || "https://api.dicebear.com/7.x/bottts/svg?seed=user";
    }
  } else {
    if (loginBtn) loginBtn.style.display = "inline-flex";
    if (userProfile) userProfile.style.display = "none";
  }
}


