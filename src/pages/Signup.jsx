import { useState } from "react";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";

const pageBackground = "radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 20%), linear-gradient(180deg, #07101f 0%, #0f172a 100%)";
const cardBackground = "#111827";
const inputBackground = "#0f172a";
const borderColor = "rgba(148, 163, 184, 0.18)";
const accentColor = "#2563eb";

export default function Signup() {
  const navigate = useNavigate();

  // I-store ang input at role para sa pag-create ng account.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("security");
  const [subRole, setSubRole] = useState("Admin");

  function handleEmailChange(event) {
    setEmail(event.target.value);
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);
  }

  function handleRoleChange(event) {
    setRole(event.target.value);
  }

  function handleSubRoleChange(event) {
    setSubRole(event.target.value);
  }

  async function handleSignup(event) {
    // Step 1: pigilan ang pag-submit ng form.
    // Step 2: gumawa ng Firebase account.
    // Step 3: i-save ang role at sub-role sa Firestore.
    // Step 4: mag-sign out at bumalik sa login page.
    event.preventDefault();

    try {
      const signupResult = await createUserWithEmailAndPassword(auth, email, password);
      const isAuthorizedRole = role === "authorized";
      const userData = {
        email,
        role,
        subRole: null
      };

      if (isAuthorizedRole) {
        userData.subRole = subRole;
      }

      await setDoc(doc(db, "users", signupResult.user.email), userData);
      await signOut(auth);
      navigate("/", { replace: true });
    } catch (error) {
      alert(error.message);
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

          <label style={styles.label} htmlFor="role">
            Role
          </label>
          <select id="role" value={role} onChange={handleRoleChange} style={styles.input}>
            <option value="security">Security</option>
            <option value="authorized">Authorized Personnel</option>
          </select>

          {subRoleSection}

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
