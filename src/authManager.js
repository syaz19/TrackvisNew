let authSetter = null;

function createEmptyAuthState() {
  return { status: "ready", user: null, userData: null };
}

export function registerAuthSetter(func) {
  authSetter = func;
}

export function clearAuthState() {
  if (typeof authSetter === "function") {
    authSetter(createEmptyAuthState());
  }
}

export function unregisterAuthSetter() {
  authSetter = null;
}

export default { registerAuthSetter, clearAuthState, unregisterAuthSetter };
