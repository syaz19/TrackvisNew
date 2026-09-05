
import { useState } from "react";

import { createUserWithEmailAndPassword, signOut } from "firebase/auth";

import { auth, db } from "../firebase";

import { doc, setDoc } from "firebase/firestore";

import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import TrackvisLogo from "../components/TrackvisLogo";

const pageBackground = "linear-gradient(rgba(9, 13, 26, 0.72), rgba(17, 21, 43, 0.82)), url('/images/finalbg.png') center / cover no-repeat";
const cardBackground = "linear-gradient(rgba(17, 21, 43, 0.72), rgba(17, 21, 43, 0.84))";
const inputBackground = "rgba(17, 21, 43, 0.82)";
const borderColor = "#2A3150";
const accentColor = "#4F46E5";


export default function Signup() {
  
  const [email, setEmail] = useState("");

  
  const [password, setPassword] = useState("");

  
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  
  const [role, setRole] = useState("security");

  
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

  function handlePasswordToggle() {
    setShowPassword(!showPassword);
  }

  function handleConfirmPasswordToggle() {
    setShowConfirmPassword(!showConfirmPassword);
  }

  function getPasswordType(isVisible) {
    if (isVisible) {
      return "text";
    }

    return "password";
  }

  function getPasswordIcon(isVisible) {
    if (isVisible) {
      return <Eye size={20} />;
    }

    return <EyeOff size={20} />;
  }

  function handleRoleChange(event) {
    setRole(event.target.value);
  }

  function handleSubRoleChange(event) {
    setSubRole(event.target.value);
  }

  
  async function handleSignup(event) {
    
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
      setErrorMessage("Use a correct Email to create an account.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      
      sessionStorage.setItem("trackvis-signup-pending", "1");
      
      const signupResult = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      
      const authorizedRoleSelected = role === "authorized";
      
      const userData = {
        email: trimmedEmail,
        role,
        subRole: null
      };

      
      if (authorizedRoleSelected) {
        userData.subRole = subRole;
      }

      
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
    <div className="auth-page-mobile" style={styles.page}>
      <div style={styles.brand}>
        <div style={styles.brandMark}><TrackvisLogo /></div>
        <div style={styles.brandName}>TRACK<span style={styles.brandAccent}>VIS</span></div>
        <div style={styles.brandSubtitle}>PROFESSIONAL</div>
      </div>
      <div className="auth-card-mobile" style={styles.card}>
        <div style={styles.header}>
          <div style={styles.headerRow}>
            <h1 style={styles.title}>Create Account</h1>
            <img src="/images/scc.png" alt="San Carlos College" style={styles.schoolBadge} />
          </div>
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
          <div style={styles.passwordWrapper}>
            <input
              id="password"
              type={getPasswordType(showPassword)}
              value={password}
              onChange={handlePasswordChange}
              placeholder="********"
              style={styles.passwordInput}
            />
            <button type="button" onClick={handlePasswordToggle} style={styles.passwordToggle} aria-label="Show or hide password">
              {getPasswordIcon(showPassword)}
            </button>
          </div>

          <label style={styles.label} htmlFor="confirmPassword">
            Confirm Password
          </label>
          <div style={styles.passwordWrapper}>
            <input
              id="confirmPassword"
              type={getPasswordType(showConfirmPassword)}
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder="********"
              style={styles.passwordInput}
            />
            <button type="button" onClick={handleConfirmPasswordToggle} style={styles.passwordToggle} aria-label="Show or hide confirm password">
              {getPasswordIcon(showConfirmPassword)}
            </button>
          </div>

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
      <div style={styles.schoolFooter}>
        <div style={styles.schoolMark}><TrackvisLogo /></div>
        <div>
          <strong style={styles.schoolName}>San Carlos College</strong>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    justifyContent: "center",
    alignItems: "center",
    padding: "18px",
    background: pageBackground,
    gridTemplateRows: "auto 1fr auto",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "12px"
  },
  brand: {
    justifySelf: "center",
    textAlign: "center",
    lineHeight: 1
  },
  brandMark: {
    width: "54px",
    height: "60px",
    margin: "0 auto 5px",
    display: "grid",
    placeItems: "center",
    color: "#f8fafc",
    fontSize: "25px"
  },
  brandName: {
    color: "#f8fafc",
    fontSize: "27px",
    fontWeight: 800,
    letterSpacing: "0.02em"
  },
  brandAccent: {
    color: "#8b5cf6"
  },
  brandSubtitle: {
    marginTop: "7px",
    color: "#d1d5db",
    fontSize: "9px",
    letterSpacing: "0.28em"
  },
  card: {
    width: "100%",
    maxWidth: "600px",
    padding: "30px",
    borderRadius: "40px",
    background: cardBackground,
    border: "1px solid rgba(148, 163, 184, 0.22)",
    boxShadow: "0 40px 120px rgba(9, 13, 26, 0.55)",
    overflow: "hidden",
    justifySelf: "center",
    alignSelf: "center",
    backgroundBlendMode: "soft-light, normal"
  },
  header: {
    marginBottom: "20px"
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px"
  },
  title: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "28px"
  },
  schoolBadge: {
    width: "62px",
    height: "62px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid rgba(248, 113, 113, 0.95)",
    background: "#fff",
    boxShadow: "0 0 0 4px rgba(239, 68, 68, 0.12), 0 12px 24px rgba(15, 23, 42, 0.35)",
    flexShrink: 0,
    transform: "translateY(8px)"
  },
  subtitle: {
    marginTop: "10px",
    color: "#94a3b8",
    fontSize: "15px",
    lineHeight: 1.6
  },
  form: {
    display: "grid",
    gap: "12px"
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
  passwordWrapper: {
    position: "relative"
  },
  passwordInput: {
    width: "100%",
    padding: "16px 52px 16px 18px",
    borderRadius: "18px",
    border: `1px solid ${borderColor}`,
    background: inputBackground,
    color: "#f8fafc",
    fontSize: "1rem",
    outline: "none",
    transition: "border-color 150ms ease, box-shadow 150ms ease"
  },
  passwordToggle: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    color: "#cbd5e1",
    cursor: "pointer",
    padding: "6px"
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
    boxShadow: "0 18px 36px rgba(79, 70, 229, 0.2)"
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
    color: "#818CF8",
    textDecoration: "none",
    fontWeight: 700
  },
  schoolFooter: {
    display: "flex",
    alignItems: "center",
    justifySelf: "center",
    gap: "12px",
    color: "#f8fafc"
  },
  schoolMark: {
    width: "32px",
    height: "36px",
    display: "grid",
    placeItems: "center",
    color: "#f8fafc",
    fontSize: "17px"
  },
  schoolName: {
    display: "block",
    fontSize: "13px"
  },
  schoolSubtitle: {
    display: "block",
    marginTop: "3px",
    color: "#a1a1aa",
    fontSize: "11px"
  }
};
