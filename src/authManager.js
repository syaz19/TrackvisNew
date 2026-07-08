let _setter = null;

export function registerAuthSetter(fn) {
  _setter = fn;
}

export function clearAuthState() {
  if (typeof _setter === "function") {
    _setter({ status: "ready", user: null, userData: null });
  }
}

export function unregisterAuthSetter() {
  _setter = null;
}

export default { registerAuthSetter, clearAuthState, unregisterAuthSetter };
