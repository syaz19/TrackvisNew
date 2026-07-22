import { useState } from "react";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();

  // Ini-store ang input at role para sa pag-create ng account.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("security");
  const [subRole, setSubRole] = useState("Admin");

  async function handleSignup(event) {
    // Pinipigilan ang default na submit at sinusubukan ang pag-register.
    event.preventDefault();

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const userData = {
        email,
        role,
        subRole: role === "authorized" ? subRole : null
      };

      await setDoc(doc(db, "users", result.user.email), userData);
      await signOut(auth);
      navigate("/", { replace: true });
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Create Account</h1>
          <p style={styles.subtitle}>Register your role and access TrackVis securely.</p>
        </div>

        <form onSubmit={handleSignup} style={styles.form}>
          <label style={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            style={styles.input}
          />

          <label style={styles.label} htmlFor="role">
            Role
          </label>
          <select id="role" value={role} onChange={(event) => setRole(event.target.value)} style={styles.input}>
            <option value="security">Security</option>
            <option value="authorized">Authorized Personnel</option>
          </select>

          {role === "authorized" && (
            <>
              <label style={styles.label} htmlFor="subRole">
                Authorized Role
              </label>
              <select
                id="subRole"
                value={subRole}
                onChange={(event) => setSubRole(event.target.value)}
                style={styles.input}
              >
                <option value="Admin">Admin</option>
                <option value="Registrar">Registrar</option>
                <option value="Guidance Counselor">Guidance Counselor</option>
                <option value="CABA Dean">CABA Dean</option>
                <option value="IT Dean">IT Dean</option>
                <option value="Criminology Dean">Criminology Dean</option>
                <option value="Education Dean">Education Dean</option>
              </select>
            </>
          )}

          <button type="submit" style={styles.button}>
            Create Account
          </button>
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
    background: "radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 20%), linear-gradient(180deg, #07101f 0%, #0f172a 100%)"
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    padding: "42px",
    borderRadius: "28px",
    background: "#111827",
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
    border: "1px solid rgba(148, 163, 184, 0.18)",
    background: "#0f172a",
    color: "#f8fafc",
    fontSize: "1rem",
    outline: "none"
  },
  button: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "none",
    background: "#2563eb",
    color: "#f8fafc",
    fontSize: "1rem",
    fontWeight: 600,
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
