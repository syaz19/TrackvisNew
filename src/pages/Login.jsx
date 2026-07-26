import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { browserSessionPersistence, setPersistence, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const pageBackground = "radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 20%), linear-gradient(180deg, #07101f 0%, #0f172a 100%)";
const cardBackground = "#111827";
const inputBackground = "#0f172a";
const borderColor = "rgba(148, 163, 184, 0.18)";
const accentColor = "#2563eb";

export default function Login() {
  // I-store ang input ng user sa form.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  function handleEmailChange(event) {
    setEmail(event.target.value);
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);
  }

  async function handleLogin(event) {
    // Step 1: pigilan ang pag-submit ng form.
    // Step 2: subukan ang login sa Firebase.
    // Step 3: basahin ang role ng user at dalhin sa tamang page.
    event.preventDefault();

    try {
      await setPersistence(auth, browserSessionPersistence);
      const loginResult = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", loginResult.user.email));
      let userData = null;

      if (userDoc.exists()) {
        userData = userDoc.data();
      }

      let nextRoute = "/authorized";

      if (userData !== null && userData !== undefined && userData.role === "security") {
        nextRoute = "/security";
      }

      navigate(nextRoute, { replace: true });
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Login</h1>
          <p style={styles.subtitle}>Access your TrackVis account.</p>
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
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

          <button type="submit" style={styles.button}>
            Login
          </button>
        </form>

        <div style={styles.footer}>
          <span style={styles.footerText}>No account yet?</span>
          <Link to="/signup" style={styles.link}>
            Create Account
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
    padding: "42px",
    borderRadius: "28px",
    background: cardBackground,
    border: "1px solid rgba(96, 165, 250, 0.35)",
    boxShadow: "0 35px 90px rgba(15, 23, 42, 0.55)",
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
    padding: "14px 16px",
    borderRadius: "16px",
    border: `1px solid ${borderColor}`,
    background: inputBackground,
    color: "#f8fafc",
    fontSize: "1rem",
    outline: "none"
  },
  button: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "none",
    background: accentColor,
    color: "white",
    fontSize: "1rem",
    cursor: "pointer"
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
    fontWeight: 600
  }
};
