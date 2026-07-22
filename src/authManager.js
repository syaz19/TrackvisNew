let authSetter = null;

// Gumawa ng blank auth state na puwedeng gamitin ulit.
function createEmptyAuthState() {
  return { status: "ready", user: null, userData: null };
}

export function registerAuthSetter(func) {
  // I-save ang setter para magamit sa ibang bahagi ng app.
  authSetter = func;
}

export function clearAuthState() {
  // I-reset ang auth state kapag gusto mag-logout o mag-clear.
  if (typeof authSetter === "function") {
    const emptyState = createEmptyAuthState();
    authSetter(emptyState);
  }
}

export function unregisterAuthSetter() {
  // Alisin ang setter kapag hindi na kailangan.
  authSetter = null;
}

export default { registerAuthSetter, clearAuthState, unregisterAuthSetter };
