document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const modal = $("authModal"), accountButton = $("accountButton"), closeButton = $("authClose");
  const authForm = $("authForm"), message = $("authMessage"), submitButton = $("authSubmit");
  const forgotButton = $("authForgot"), nameField = $("authNameField"), passwordField = $("authPasswordField");
  const confirmField = $("authConfirmPasswordField"), accountMenu = $("accountMenu");
  const signOutButton = $("signOutButton"), tabs = document.querySelectorAll("[data-auth-mode]");
  if (!modal || !authForm || !accountButton) return;
  let mode = "login", currentUser = null, busy = false;

  function showMessage(text, type = "") {
    if (!message) return;
    message.textContent = text;
    message.className = `auth-message ${type}`.trim();
  }
  function friendlyError(error, action) {
    const raw = String(error?.message || "").toLowerCase();
    if (/invalid login credentials|invalid email or password/.test(raw)) return "The email or password is incorrect. Please try again.";
    if (/email not confirmed/.test(raw)) return "Please confirm your email address before signing in. Check your inbox and spam folder.";
    if (/user already registered|already been registered/.test(raw)) return "An account with this email already exists. Please sign in instead.";
    if (/password should be at least|weak password|password is too short/.test(raw)) return "Choose a stronger password with at least 8 characters.";
    if (/rate limit|too many requests/.test(raw)) return "Too many attempts. Please wait a few minutes and try again.";
    if (/fetch|network|failed to connect/.test(raw)) return "We couldn't reach the account service. Check your internet connection and try again.";
    if (/captcha/.test(raw)) return "Account verification could not be completed. Please try again later.";
    return error?.message || `We couldn't ${action}. Please try again.`;
  }
  function setPasswordVisibility(button, visible) {
    const input = $(button.dataset.togglePassword);
    if (!input) return;
    input.type = visible ? "text" : "password";
    button.textContent = visible ? "Hide" : "Show";
    button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${input.id === "authPassword" ? "password" : "confirm password"}`);
    button.setAttribute("aria-pressed", String(visible));
  }
  function resetVisibility() {
    document.querySelectorAll("[data-toggle-password]").forEach(button => setPasswordVisibility(button, false));
  }
  function openModal(initialMode = "login") {
    closeAccountMenu(); setMode(initialMode);
    modal.hidden = false; modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("auth-open");
    window.setTimeout(() => $("authEmail")?.focus(), 50);
  }
  function closeModal() {
    accountButton.focus(); modal.hidden = true; modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("auth-open"); showMessage("");
  }
  function closeAccountMenu() {
    if (accountMenu) accountMenu.hidden = true;
    accountButton.setAttribute("aria-expanded", "false");
  }
  function setMode(nextMode) {
    mode = nextMode;
    const isRegister = mode === "register", isReset = mode === "reset";
    $("authTitle").innerHTML = isRegister ? "Create your <em>account.</em>" : isReset ? "Reset your <em>password.</em>" : "Welcome <em>back.</em>";
    $("authDescription").textContent = isRegister
      ? "Join the community, save your quiz progress and collect achievements."
      : isReset ? "Enter your email address and we'll send you a password reset link."
      : "Sign in to save your quiz progress, collect badges and join the community.";
    nameField.hidden = !isRegister; passwordField.hidden = isReset;
    confirmField.hidden = !isRegister; forgotButton.hidden = isRegister || isReset; $("authTabs").hidden = isReset;
    $("authName").required = isRegister; $("authPassword").required = !isReset;
    $("authConfirmPassword").required = isRegister;
    $("authPassword").autocomplete = isRegister ? "new-password" : "current-password";
    submitButton.textContent = isRegister ? "Create account ↗" : isReset ? "Send reset link ↗" : "Sign in ↗";
    tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.authMode === mode));
    authForm.reset(); resetVisibility(); showMessage("");
  }
  function showAccount(user) {
    currentUser = user || null;
    const label = $("accountButtonLabel");
    if (currentUser) {
      label.textContent = currentUser.user_metadata?.display_name || currentUser.email?.split("@")[0] || "My account";
      $("accountMenuEmail").textContent = currentUser.email || "Signed in";
      signOutButton.hidden = false;
    } else {
      label.textContent = "Sign in";
      if (accountMenu) accountMenu.hidden = true;
    }
  }
  async function routeAdminAfterLogin(user) {
    if (!user || !window.gnsSupabase) return false;
    const { data, error } = await window.gnsSupabase.rpc("is_admin");
    if (error) throw error;
    if (data === true) {
      showMessage("Administrator verified. Opening your dashboard…", "success");
      window.setTimeout(() => { window.location.assign("admin.html"); }, 350);
      return true;
    }
    return false;
  }

  accountButton.addEventListener("click", async () => {
    if (currentUser) {
      const open = accountMenu?.hidden;
      if (accountMenu) accountMenu.hidden = !open;
      accountButton.setAttribute("aria-expanded", String(Boolean(open)));
      return;
    }
    openModal("login");
  });
  signOutButton?.addEventListener("click", async () => {
    if (busy || !window.gnsAuth) return;
    busy = true; signOutButton.disabled = true;
    try {
      await window.gnsAuth.signOut();
      showAccount(null); closeAccountMenu();
      const label = $("accountButtonLabel");
      if (label) {
        label.textContent = "Signed out";
        window.setTimeout(() => { if (!currentUser) label.textContent = "Sign in"; }, 1800);
      }
      accountButton.focus();
    } catch (error) {
      openModal("login"); showMessage(friendlyError(error, "sign out"), "error");
    } finally { busy = false; signOutButton.disabled = false; }
  });
  closeButton?.addEventListener("click", closeModal);
  modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeModal(); });
  document.addEventListener("click", event => {
    if (!event.target.closest(".account-menu-wrap") && accountMenu && !accountMenu.hidden) closeAccountMenu();
  });
  tabs.forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.authMode)));
  forgotButton?.addEventListener("click", () => setMode("reset"));
  document.querySelectorAll("[data-toggle-password]").forEach(button => button.addEventListener("click", () => {
    const input = $(button.dataset.togglePassword); setPasswordVisibility(button, input?.type === "password");
  }));

  authForm.addEventListener("submit", async event => {
    event.preventDefault(); if (busy) return;
    const email = $("authEmail").value.trim(), password = $("authPassword").value;
    const displayName = $("authName").value.trim(), confirmPassword = $("authConfirmPassword").value;
    if (mode === "register") {
      if (!displayName) return showMessage("Please enter your display name.", "error");
      if (password.length < 8) return showMessage("Your password must contain at least 8 characters.", "error");
      if (password !== confirmPassword) return showMessage("The passwords do not match. Please check both fields.", "error");
    }
    if (!email) return showMessage("Please enter your email address.", "error");
    busy = true; submitButton.disabled = true; showMessage(mode === "register" ? "Creating your account…" : mode === "reset" ? "Sending reset link…" : "Signing you in…");
    try {
      if (!window.gnsAuth) throw new Error("Account services are not available. Please refresh the page and try again.");
      if (mode === "register") {
        const result = await window.gnsAuth.signUp(email, password, displayName);
        showMessage(result.message || "Account created. Please check your email to confirm your account.", "success");
        setMode("login"); showMessage(result.message || "Account created. Please check your email to confirm your account.", "success");
      } else if (mode === "reset") {
        await window.gnsAuth.resetPassword(email);
        showMessage("If an account exists for this email, a password reset link will be sent.", "success");
      } else {
        const result = await window.gnsAuth.signIn(email, password);
        showAccount(result.user);
        let isAdmin = false;
        try { isAdmin = await routeAdminAfterLogin(result.user); }
        catch (roleError) {
          console.error("Could not verify administrator role:", roleError);
          showMessage("You are signed in, but administrator access could not be checked. Please refresh and try again. If this is the admin account, verify its admin role in Supabase.", "error");
          return;
        }
        if (!isAdmin) { showMessage("You are signed in successfully.", "success"); window.setTimeout(closeModal, 700); }
      }
    } catch (error) { showMessage(friendlyError(error, mode === "register" ? "create your account" : mode === "reset" ? "send the reset link" : "sign you in"), "error"); }
    finally { busy = false; submitButton.disabled = false; }
  });

  if (window.gnsAuth) {
    window.gnsAuth.onAuthStateChange(({ user }) => showAccount(user));
    window.gnsAuth.getCurrentUser().then(showAccount).catch(error => {
      console.warn("Could not restore account session:", error); showAccount(null);
    });
  }
  $("quizRegisterButton")?.addEventListener("click", event => { event.preventDefault(); openModal("register"); });
  showAccount(null);
});
