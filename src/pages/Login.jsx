
import { useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import { browserSessionPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase";
import { Eye, EyeOff } from "lucide-react";
import TrackvisLogo from "../components/TrackvisLogo";


const pageBackground = "linear-gradient(rgba(9, 13, 26, 0.72), rgba(17, 21, 43, 0.82)), url('/images/finalbg.png') center / cover no-repeat";
const cardBackground = "linear-gradient(rgba(17, 21, 43, 0.72), rgba(17, 21, 43, 0.84))";
const inputBackground = "rgba(17, 21, 43, 0.82)";
const borderColor = "#2A3150";
const accentColor = "#4F46E5";


export default function Login() {
  
  const [email, setEmail] = useState("");

  
  const [password, setPassword] = useState("");

 
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  
  const navigate = useNavigate();

  
  function handleEmailChange(event) {
    setEmail(event.target.value);
  }

  
  function handlePasswordChange(event) {
    setPassword(event.target.value);
  }

  function handlePasswordToggle() {
    setShowPassword(!showPassword);
  }

  function getPasswordType() {
    if (showPassword) {
      return "text";
    }

    return "password";
  }

  function getPasswordIcon() {
    if (showPassword) {
      return <Eye size={20} />;
    }

    return <EyeOff size={20} />;
  }

  
  async function handleLogin(event) {
    
    event.preventDefault();

    try {
      await setPersistence(auth, browserSessionPersistence);
      const loginResult = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", loginResult.user.email));

      if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error("Account does not exist. Check your email or sign up.");
      }

      const userData = userDoc.data();
      let nextRoute = "/authorized/map";

      if (userData.role === "security") {
        nextRoute = "/security/map";
      }

      navigate(nextRoute, { replace: true });
    } catch (error) {
      const errorCode = error && error.code ? error.code : "";
      let message = error && error.message ? error.message : "Login failed. Please try again.";
      let clearEmail = false;
      let clearPassword = false;

      if (errorCode === "auth/user-not-found" || message.includes("Account does not exist")) {
        message = "Account does not exist. Check your email or sign up.";
        clearEmail = true;
      } else if (errorCode === "auth/wrong-password") {
        message = "Wrong password. Please try again.";
        clearPassword = true;
      } else if (errorCode === "auth/invalid-email") {
        message = "Please enter a valid email address.";
        clearEmail = true;
      }

      if (clearEmail) {
        setEmail("");
      }
      if (clearPassword) {
        setPassword("");
      }
      if (!clearEmail && !clearPassword) {
        setPassword("");
      }
      setErrorMessage(message);
    }
  }

  
  return (
    <div className="auth-page-mobile" style={styles.page}>
      <div style={styles.brand}>
        <div style={styles.brandMark}><TrackvisLogo /></div>
        <div style={styles.brandName}>TRACK<span style={styles.brandAccent}>VIS</span></div>
        <div style={styles.brandSubtitle}>PROFESSIONAL</div>
      </div>
      {}
      <div className="auth-card-mobile" style={styles.card}>
        {}
        <div style={styles.header}>
          <div style={styles.headerRow}>
            <h1 style={styles.title}>Login</h1>
            <img src="/images/scc.png" alt="San Carlos College" style={styles.schoolBadge} />
          </div>
          <p style={styles.subtitle}>Secure access to TrackVis Professional.</p>
        </div>

        {}
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
          <div style={styles.passwordWrapper}>
            <input
              id="password"
              type={getPasswordType()}
              value={password}
              onChange={handlePasswordChange}
              placeholder="********"
              style={styles.passwordInput}
            />
            <button type="button" onClick={handlePasswordToggle} style={styles.passwordToggle} aria-label="Show or hide password">
              {getPasswordIcon()}
            </button>
          </div>

          {}
          <button type="submit" style={styles.button}>
            Login
          </button>
          {}
          {errorMessage && <p style={styles.errorText}>{errorMessage}</p>}
        </form>

        {}
        <div style={styles.footer}>
          <span style={styles.footerText}>No account yet?</span>
          <Link to="/signup" style={styles.link}>
            Create Account
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
    padding: "24px",
    background: pageBackground,
    gridTemplateRows: "auto 1fr auto",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "15px"
  },
  brand: {
    justifySelf: "center",
    textAlign: "center",
    lineHeight: 1
  },
  brandMark: {
    width: "54px",
    height: "60px",
    margin: "0 auto 8px",
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
    color: "white",
    fontSize: "1rem",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 18px 36px rgba(79, 70, 229, 0.2)"
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
  
  errorText: {
    marginTop: "12px",
    color: "#f8d7da",
    background: "rgba(220, 38, 38, 0.08)",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid rgba(248, 113, 113, 0.28)",
    fontSize: "0.95rem",
    lineHeight: 1.4
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
