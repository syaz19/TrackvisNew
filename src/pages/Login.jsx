/**
 * Login.jsx
 *
 * Layunin: I-render ang login form at i-authenticate ang user gamit ang Firebase Auth.
 * - Nagbibigay ng form para sa email at password.
 * - Kapag successful ang login, nire-redirect ang user papunta sa kani-kanilang landing page (security o authorized) via `App` routing.
 * - Bahagi ng app: authentication flow. Kung walang valid credentials, magpapakita ng error message.
 *
 * Paano gumagana:
 * 1. User magsu-submit ng email/password.
 * 2. Tatawagin ang `signInWithEmailAndPassword(auth, email, password)`.
 * 3. On success, Firebase auth state sa `App` mag-uupdate at ire-redirect ang user.
 *
 * Kaugnay na files: `src/App.jsx`, `src/authManager.js`, `src/components/Sidebar.jsx`.
 */
// I-import ang React hook para magamit ang local state sa login form.
import { useState } from "react";
// I-import ang routing components para ma-navigate sa ibang page pagkatapos ng login.
import { Link, useNavigate } from "react-router-dom";
// I-import ang Firebase auth functions para sa authentication process.
import { browserSessionPersistence, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
// I-import ang Firestore helpers para buksan ang user document sa database.
import { doc, getDoc } from "firebase/firestore";
// I-import ang initialized auth at database instance mula sa firebase config.
import { auth, db } from "../firebase";

// I-define ang mga color at background na gagamitin sa login UI.
const pageBackground = "linear-gradient(rgba(9, 13, 26, 0.72), rgba(17, 21, 43, 0.82)), url('/images/finalbg.png') center / cover no-repeat";
const cardBackground = "linear-gradient(rgba(17, 21, 43, 0.72), rgba(17, 21, 43, 0.84))";
const inputBackground = "rgba(17, 21, 43, 0.82)";
const borderColor = "#2A3150";
const accentColor = "#4F46E5";

// Login page:
// Ito ang page na ginagamit para mag-login ang user.
// Kung valid ang credentials, titingnan ang user role at ide-redirect ito sa tamang dashboard.
// I-export ang login component na nag-render ng authentication form.
export default function Login() {
  // email: text na tinatype ng user sa email field.
  const [email, setEmail] = useState("");

  // password: text na tinatype ng user sa password field.
  const [password, setPassword] = useState("");

  // errorMessage: lalabas kapag may mali sa login, gaya ng wrong password o invalid account.
  const [errorMessage, setErrorMessage] = useState("");

  // navigate: ginagamit para lumipat sa ibang page pagkatapos ng login.
  const navigate = useNavigate();

  // I-update ang email state kapag nag-type ang user at pinapanatili ang error message.
  function handleEmailChange(event) {
    setEmail(event.target.value);
  }

  // I-update ang password state kapag nag-type ang user at pinapanatili ang error message.
  function handlePasswordChange(event) {
    setPassword(event.target.value);
  }

  // handleLogin:
  // Ito ang function na tinatawag kapag pinindot ang Login button.
  // Dito magse-sign in sa Firebase, kukunin ang role sa Firestore, at papunta sa tamang route.
  async function handleLogin(event) {
    // Step 1: pigilan ang pag-submit ng form.
    // Step 2: subukan ang login sa Firebase.
    // Step 3: basahin ang role ng user at dalhin sa tamang page.
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
      const errorCode = error?.code || "";
      let message = error?.message || "Login failed. Please try again.";
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

  // I-render ang buong login layout kasama ang form at footer.
  return (
    <div className="auth-page-mobile" style={styles.page}>
      <div style={styles.brand}>
        <div style={styles.brandMark}>◉</div>
        <div style={styles.brandName}>TRACK<span style={styles.brandAccent}>VIS</span></div>
        <div style={styles.brandSubtitle}>PROFESSIONAL</div>
      </div>
      {/* I-wrap ang login card sa gitna ng page para mas presentable ang layout. */}
      <div className="auth-card-mobile" style={styles.card}>
        {/* I-display ang header na may title at subtitle para sa login screen. */}
        <div style={styles.header}>
          <div style={styles.headerRow}>
            <h1 style={styles.title}>Login</h1>
            <img src="/images/scc.png" alt="San Carlos College" style={styles.schoolBadge} />
          </div>
          <p style={styles.subtitle}>Secure access to TrackVis Professional.</p>
        </div>

        {/* I-render ang form para sa email at password input. */}
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

          {/* I-render ang submit button para simulan ang authentication. */}
          <button type="submit" style={styles.button}>
            Login
          </button>
          {/* I-display ang error message kapag may problema sa login. */}
          {errorMessage && <p style={styles.errorText}>{errorMessage}</p>}
        </form>

        {/* I-render ang footer link para sa user na gusto gumawa ng account. */}
        <div style={styles.footer}>
          <span style={styles.footerText}>No account yet?</span>
          <Link to="/signup" style={styles.link}>
            Create Account
          </Link>
        </div>
      </div>
      <div style={styles.schoolFooter}>
        <div style={styles.schoolMark}>✦</div>
        <div>
          <strong style={styles.schoolName}>San Carlos College</strong>
        </div>
      </div>
    </div>
  );
}

// I-define ang inline styles para sa login page layout at visual design.
const styles = {
  // Ito ang main container na nag-uukit ng full-page background at center alignment.
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
    fontSize: "25px",
    background: "#6d28d9",
    clipPath: "polygon(50% 0, 92% 14%, 88% 68%, 50% 100%, 12% 68%, 8% 14%)",
    boxShadow: "0 0 24px rgba(109, 40, 217, 0.45)"
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
  // Ito ang card na nagho-hold ng form at nagbibigay ng modern glass-like look.
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
  // Ito ang section na naglalaman ng title at subtitle sa ibabaw ng form.
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
  // Ito ang malaking heading na nagpapakita ng pangalan ng page.
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
  // Ito ang smaller text na nagbibigay ng description sa login screen.
  subtitle: {
    marginTop: "10px",
    color: "#94a3b8",
    fontSize: "15px",
    lineHeight: 1.6
  },
  // Ito ang form layout na nag-aayos ng email, password, at button vertically.
  form: {
    display: "grid",
    gap: "12px"
  },
  // Ito ang label style para sa bawat input field.
  label: {
    color: "#cbd5e1",
    fontSize: "0.9rem"
  },
  // Ito ang style ng input boxes para sa email at password.
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
  // Ito ang primary button style para sa login action.
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
  // Ito ang footer section na naglalaman ng link para sa signup.
  footer: {
    marginTop: "24px",
    textAlign: "center"
  },
  // Ito ang text sa tabi ng create-account link.
  footerText: {
    color: "#94a3b8",
    marginRight: "8px"
  },
  // Ito ang style ng clickable link para sa bagong account.
  link: {
    color: "#818CF8",
    textDecoration: "none",
    fontWeight: 700
  },
  // Ito ang style ng error box na nagpapakita ng login failure message.
  // Ito ang style ng error box na nagpapakita ng login failure message.
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
    fontSize: "17px",
    background: "#6d28d9",
    clipPath: "polygon(50% 0, 92% 14%, 88% 68%, 50% 100%, 12% 68%, 8% 14%)"
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
