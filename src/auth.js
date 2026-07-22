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
    if (typeof onUserChangeCallback === 'function') onUserChangeCallback(null);
    return;
  }

  // Get current active session
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      renderAuthUI(currentUser);
      await migrateLocalDataToCloud(currentUser, false);
      if (typeof onUserChangeCallback === 'function') onUserChangeCallback(currentUser);
    } else {
      renderAuthUI(null);
      if (typeof onUserChangeCallback === 'function') onUserChangeCallback(null);
    }
  } catch (e) {
    console.warn("[Auth] Failed to get session:", e);
    renderAuthUI(null);
    if (typeof onUserChangeCallback === 'function') onUserChangeCallback(null);
  }

  // Listen for auth state changes (login, logout)
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log(`[Auth State Change] Event: ${event}`);
    currentUser = session?.user || null;
    renderAuthUI(currentUser);

    if (event === 'SIGNED_IN' && currentUser) {
      await migrateLocalDataToCloud(currentUser, false);
      if (typeof onUserChangeCallback === 'function') onUserChangeCallback(currentUser);
    } else if (event === 'SIGNED_OUT') {
      if (typeof onUserChangeCallback === 'function') onUserChangeCallback(null);
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
            currentUser = sessionData.user;
            renderAuthUI(currentUser);
            await migrateLocalDataToCloud(currentUser, false);
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
  if (!supabase) return;
  
  try {
    await supabase.auth.signOut();
    currentUser = null;
    
    // Clean up cached events of the logged-out user
    localStorage.removeItem("desktop_scheduler_events");
    
    renderAuthUI(null);
  } catch (err) {
    console.error("[Auth Signout Error]", err);
  }
}

function setupAuthEventListeners() {
  const loginBtn = document.getElementById("google-login-btn");
  const logoutBtn = document.getElementById("auth-logout-btn");
  const migrateBtn = document.getElementById("manual-migrate-btn");

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
  if (migrateBtn) {
    migrateBtn.onclick = (e) => {
      if (e) e.preventDefault();
      exportAllLocalDataToCloud(true);
    };
  }
}

// Bind to window global for guaranteed inline/direct calls
if (typeof window !== 'undefined') {
  window.signInWithGoogle = signInWithGoogle;
  window.signOut = signOut;
  window.exportAllLocalDataToCloud = (isManual = true) => exportAllLocalDataToCloud(isManual);
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
 * Exports local events to Supabase cloud database with deduplication
 */
export async function exportAllLocalDataToCloud(isManual = true) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    if (isManual) alert("Supabase 클라우드 연결 설정이 필요합니다. (local.env / 환경변수 확인)");
    return false;
  }

  const localEventsData = localStorage.getItem("desktop_scheduler_events");
  if (!localEventsData) {
    if (isManual) alert("이전할 로컬 일정 데이터가 없습니다.");
    return false;
  }

  try {
    const events = JSON.parse(localEventsData);
    if (!Array.isArray(events) || events.length === 0) {
      if (isManual) alert("이전할 로컬 일정 데이터가 없습니다.");
      return false;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || null;

    // Check existing cloud events to prevent duplicate insertion
    let existingQuery = supabase.from('scheduler_events').select('title, date');
    if (userId) existingQuery = existingQuery.eq('user_id', userId);
    const { data: existingEvents } = await existingQuery;

    const existingKeys = new Set(
      (existingEvents || []).map(e => `${e.title}_${e.date}`)
    );

    let successCount = 0;
    for (const evt of events) {
      const key = `${evt.title}_${evt.date}`;
      if (existingKeys.has(key)) {
        // Skip duplicate event
        continue;
      }

      const dbEvent = {
        title: evt.title,
        date: evt.date,
        time: evt.time || "09:00",
        end_time: evt.endTime || evt.end_time || "10:00",
        color: evt.color || "#3b82f6",
        ...(userId ? { user_id: userId } : {})
      };

      const { error } = await supabase.from('scheduler_events').insert([dbEvent]);
      if (!error) {
        successCount++;
        existingKeys.add(key);
      }
    }

    if (successCount > 0) {
      console.log(`[Migration] Successfully exported ${successCount} local events to cloud.`);
    } else {
      console.log("[Migration] All local events are already synced to cloud.");
    }

    return true;
  } catch (e) {
    console.error("[Migration Error]", e);
    return false;
  }
}

export async function migrateLocalDataToCloud(user, isManual = false) {
  if (!user) return;
  const migrationFlag = `migrated_${user.id}`;
  if (localStorage.getItem(migrationFlag)) return;

  const success = await exportAllLocalDataToCloud(isManual);
  if (success) {
    localStorage.setItem(migrationFlag, "true");
  }
}
