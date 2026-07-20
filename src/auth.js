import { getSupabaseClient } from './supabaseClient.js';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export async function initAuth(onUserChangeCallback) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log("[Auth] Supabase is not configured yet.");
    renderAuthUI(null);
    return;
  }

  // Get current active session
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      renderAuthUI(currentUser);
      await migrateLocalDataToCloud(currentUser);
      if (typeof onUserChangeCallback === 'function') onUserChangeCallback(currentUser);
    } else {
      renderAuthUI(null);
    }
  } catch (e) {
    console.warn("[Auth] Failed to get session:", e);
    renderAuthUI(null);
  }

  // Listen for auth state changes (login, logout)
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log(`[Auth State Change] Event: ${event}`);
    currentUser = session?.user || null;
    renderAuthUI(currentUser);

    if (event === 'SIGNED_IN' && currentUser) {
      await migrateLocalDataToCloud(currentUser);
      if (typeof onUserChangeCallback === 'function') onUserChangeCallback(currentUser);
    } else if (event === 'SIGNED_OUT') {
      if (typeof onUserChangeCallback === 'function') onUserChangeCallback(null);
    }
  });

  setupAuthEventListeners();
}

export async function signInWithGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    alert("Supabase 클라우드 연결 설정이 필요합니다.");
    return;
  }

  const redirectUrl = window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl
    }
  });

  if (error) {
    console.error("[Auth Error] Google sign-in failed:", error.message);
    alert(`로그인 실패: ${error.message}`);
  }
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  
  await supabase.auth.signOut();
  currentUser = null;
  renderAuthUI(null);
  window.location.reload();
}

function setupAuthEventListeners() {
  const loginBtn = document.getElementById("google-login-btn");
  const logoutBtn = document.getElementById("auth-logout-btn");

  if (loginBtn) {
    loginBtn.addEventListener("click", () => signInWithGoogle());
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => signOut());
  }
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

/**
 * Automatically migrates existing local desktop_scheduler_events to Supabase cloud
 * under the signed-in user's account (user_id).
 */
export async function migrateLocalDataToCloud(user) {
  if (!user) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const localKey = "desktop_scheduler_events";
  const localData = localStorage.getItem(localKey);
  if (!localData) return;

  try {
    const events = JSON.parse(localData);
    if (!Array.isArray(events) || events.length === 0) return;

    // Check if migration has already been executed for this user
    const migrationFlag = `migrated_${user.id}`;
    if (localStorage.getItem(migrationFlag)) return;

    console.log(`[Migration] Migrating ${events.length} local events to Supabase cloud for user ${user.id}...`);

    for (const evt of events) {
      const dbEvent = {
        title: evt.title,
        date: evt.date,
        time: evt.time || "09:00",
        type: evt.type || "work",
        priority: evt.priority || "medium",
        user_id: user.id
      };

      // Insert event into Supabase scheduler_events
      await supabase.from('scheduler_events').insert([dbEvent]);
    }

    localStorage.setItem(migrationFlag, "true");
    console.log("[Migration] Local events successfully migrated to cloud.");
  } catch (e) {
    console.error("[Migration Error] Failed to migrate local data to cloud:", e);
  }
}
