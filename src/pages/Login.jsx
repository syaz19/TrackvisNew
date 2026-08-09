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
const pageBackground = "radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 20%), linear-gradient(180deg, #07101f 0%, #0f172a 100%)";
const cardBackground = "#111827";
const inputBackground = "#0f172a";
const borderColor = "rgba(148, 163, 184, 0.18)";
const accentColor = "#2563eb";

// I-export ang login component na nag-render ng authentication form.
export default function Login() {
  // I-store ang email at password na ini-enter ng user.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // I-store ang error message para maipakita kapag may mali sa login.
  const [errorMessage, setErrorMessage] = useState("");
  // I-define ang navigate function para ilipat ang user sa tamang route.
  const navigate = useNavigate();

  // I-update ang email state kapag nag-type ang user at pinapanatili ang error message.
  function handleEmailChange(event) {
    setEmail(event.target.value);
  }

  // I-update ang password state kapag nag-type ang user at pinapanatili ang error message.
  function handlePasswordChange(event) {
    setPassword(event.target.value);
  }

  // I-handle ang proseso ng login kapag pinindot ang submit button.
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
    <div style={styles.page}>
      {/* I-wrap ang login card sa gitna ng page para mas presentable ang layout. */}
      <div style={styles.card}>
        {/* I-display ang header na may title at subtitle para sa login screen. */}
        <div style={styles.header}>
          <h1 style={styles.title}>Login</h1>
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
    </div>
  );
}

// I-define ang inline styles para sa login page layout at visual design.
const styles = {
  // Ito ang main container na nag-uukit ng full-page background at center alignment.
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    background: pageBackground
  },
  // Ito ang card na nagho-hold ng form at nagbibigay ng modern glass-like look.
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
  // Ito ang section na naglalaman ng title at subtitle sa ibabaw ng form.
  header: {
    marginBottom: "24px"
  },
  // Ito ang malaking heading na nagpapakita ng pangalan ng page.
  title: {
    margin: 0,
    color: "#f8fafc",
    fontSize: "32px"
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
    gap: "18px"
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
    boxShadow: "0 18px 36px rgba(37, 99, 235, 0.2)"
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
    color: "#60a5fa",
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
  }
};
