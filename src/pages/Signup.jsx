/**
 * Signup.jsx
 *
 * Line-by-line comments added: page for creating new user accounts and writing
 * role/subRole info to Firestore. Uses Firebase Auth + Firestore.
 */
// React hook for local component state
import { useState } from "react";
// Firebase Auth functions used to create account and sign out
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
// Firebase instances (auth and firestore database)
import { auth, db } from "../firebase";
// Firestore helpers to write a document
import { doc, setDoc } from "firebase/firestore";
// Router helpers for navigation and links
import { Link, useNavigate } from "react-router-dom";

const pageBackground = "linear-gradient(rgba(7, 16, 31, 0.64), rgba(15, 23, 42, 0.72)), url('/images/school.jpg') center / cover no-repeat";
const cardBackground = "#111827";
const inputBackground = "#0f172a";
const borderColor = "rgba(148, 163, 184, 0.18)";
const accentColor = "#2563eb";

export default function Signup() {
  // State: email input field
  const [email, setEmail] = useState("");
  // State: password input field
  const [password, setPassword] = useState("");
  // State: confirm password input field
  const [confirmPassword, setConfirmPassword] = useState("");
  // State: role selector, default sa `security`
  const [role, setRole] = useState("security");
  // State: subRole para sa authorized personnel
  const [subRole, setSubRole] = useState("Admin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  function handleEmailChange(event) {
    setEmail(event.target.value);
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);
  }

  function handleConfirmPasswordChange(event) {
    setConfirmPassword(event.target.value);
  }

  function handleRoleChange(event) {
    setRole(event.target.value);
  }

  function handleSubRoleChange(event) {
    setSubRole(event.target.value);
  }

  async function handleSignup(event) {
    // Step 1: pigilan ang pag-submit ng form.
    // Step 2: tiyakin na valid ang email.
    // Step 3: gumawa ng Firebase account.
    // Step 4: i-save ang role at sub-role sa Firestore.
    // Step 5: mag-sign out at bumalik sa login page.
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      setConfirmPassword("");
      return;
    }

    const trimmedEmail = email.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage("Only valid Gmail addresses ending in @gmail.com are allowed for account creation.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      // Markahan ang signup flow bago mag-create ng user para maiwasan ang flash sa protected app route.
      sessionStorage.setItem("trackvis-signup-pending", "1");
      // Gumawa ng Firebase user account gamit ang email at password
      const signupResult = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      // Tukuyin kung ang napiling role ay `authorized`
      const isAuthorizedRole = role === "authorized";
      // I-build ang user document na ise-save sa `users/{email}`
      const userData = {
        email: trimmedEmail,
        role,
        subRole: null
      };

      // Kung authorized, isama ang napiling subRole
      if (isAuthorizedRole) {
        userData.subRole = subRole;
      }

      // Isulat ang user document (keyed by email) sa Firestore
      await setDoc(doc(db, "users", signupResult.user.email), userData);
      await signOut(auth);
      sessionStorage.removeItem("trackvis-signup-pending");
      navigate("/", { replace: true });
    } catch (error) {
      sessionStorage.removeItem("trackvis-signup-pending");
      setIsSubmitting(false);
      setErrorMessage(error.message || "Account creation failed. Please try again.");
    }
  }

  let subRoleSection = null;

  if (role === "authorized") {
    subRoleSection = (
      <>
        <label style={styles.label} htmlFor="subRole">
          Authorized Role
        </label>
        <select id="subRole" value={subRole} onChange={handleSubRoleChange} style={styles.input}>
          <option value="Admin">Admin</option>
          <option value="Registrar">Registrar</option>
          <option value="Guidance Counselor">Guidance Counselor</option>
          <option value="CABA Dean">CABA Dean</option>
          <option value="IT Dean">IT Dean</option>
          <option value="Criminology Dean">Criminology Dean</option>
          <option value="Education Dean">Education Dean</option>
          <option value="Librarian">Librarian</option>
        </select>
      </>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Create Account</h1>
          <p style={styles.subtitle}>Set up your professional TrackVis workspace.</p>
        </div>

        <form onSubmit={handleSignup} style={styles.form}>
          <label style={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="you@example.com"
            style={styles.input}
          />

          <label style={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="********"
            style={styles.input}
          />

          <label style={styles.label} htmlFor="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            placeholder="********"
            style={styles.input}
          />

          <label style={styles.label} htmlFor="role">
            Role
          </label>
          <select id="role" value={role} onChange={handleRoleChange} style={styles.input}>
            <option value="security">Security</option>
            <option value="authorized">Authorized Personnel</option>
          </select>

          {subRoleSection}

          <button type="submit" style={styles.button} disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
          {errorMessage && <p style={styles.errorText}>{errorMessage}</p>}
        </form>

        <div style={styles.footer}>
          <span style={styles.footerText}>Already registered?</span>
          <Link to="/" style={styles.link}>
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    background: pageBackground
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    padding: "44px",
    borderRadius: "32px",
    background: cardBackground,
    border: "1px solid rgba(96, 165, 250, 0.28)",
    boxShadow: "0 40px 120px rgba(15, 23, 42, 0.45)",
    overflow: "hidden"
  },
  header: {
    marginBottom: "24px"
  },
  title: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "32px"
  },
  subtitle: {
    marginTop: "10px",
    color: "#94a3b8",
    fontSize: "15px",
    lineHeight: 1.6
  },
  form: {
    display: "grid",
    gap: "18px"
  },
  label: {
    color: "#cbd5e1",
    fontSize: "0.9rem"
  },
  input: {
    width: "100%",
    padding: "16px 18px",
    borderRadius: "18px",
    border: `1px solid ${borderColor}`,
    background: inputBackground,
    color: "#f8fafc",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 150ms ease, box-shadow 150ms ease"
  },
  button: {
    width: "100%",
    padding: "15px 18px",
    borderRadius: "18px",
    border: "none",
    background: accentColor,
    color: "#f8fafc",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 18px 36px rgba(37, 99, 235, 0.2)"
  },
  errorText: {
    margin: 0,
    color: "#fca5a5",
    fontSize: "0.9rem",
    lineHeight: 1.5
  },
  footer: {
    marginTop: "24px",
    textAlign: "center"
  },
  footerText: {
    color: "#94a3b8",
    marginRight: "8px"
  },
  link: {
    color: "#60a5fa",
    textDecoration: "none",
    fontWeight: 700
  }
};
