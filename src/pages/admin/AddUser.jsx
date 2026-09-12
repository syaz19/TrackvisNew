import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Eye, EyeOff } from "lucide-react";
import { functions } from "../../firebase";

const authorizedPositions = [
  "IT Dean",
  "CABA Dean",
  "Criminology Dean",
  "Education Dean",
  "Librarian",
  "Registrar",
  "Guidance Counselor"
];

export default function AddUser() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [subRole, setSubRole] = useState(authorizedPositions[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || password.length < 6) {
      setErrorMessage("Full name, a valid email, and a password of at least 6 characters are required.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const createAuthorizedUser = httpsCallable(functions, "createAuthorizedUser");
      await createAuthorizedUser({ fullName: trimmedName, email: trimmedEmail, password, subRole });
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setMessage("Authorized Personnel account created successfully.");
    } catch (error) {
      setErrorMessage(error && error.message ? error.message : "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="admin-add-user-page">
      <div className="admin-add-user-card">
        <div className="admin-add-user-header">
          <div>
            <p className="section-kicker">Account management</p>
            <h1>Create Authorized Account</h1>
            <p>Register an Authorized Personnel account for TRACKVIS.</p>
          </div>
          <div className="admin-add-user-badge" aria-hidden="true">AU</div>
        </div>

        <form onSubmit={handleSubmit} className="admin-add-user-form">
          <label htmlFor="authorized-full-name">Full Name<input id="authorized-full-name" value={fullName} onChange={function (event) { setFullName(event.target.value); }} placeholder="Enter full name" /></label>
          <label htmlFor="authorized-email">Email<input id="authorized-email" type="email" value={email} onChange={function (event) { setEmail(event.target.value); }} placeholder="name@example.com" /></label>
          <label htmlFor="authorized-password">Password<div className="admin-password-field"><input id="authorized-password" type={showPassword ? "text" : "password"} value={password} onChange={function (event) { setPassword(event.target.value); }} placeholder="At least 6 characters" /><button type="button" onClick={function () { setShowPassword(!showPassword); }} aria-label="Show or hide password">{showPassword ? <Eye size={18} /> : <EyeOff size={18} />}</button></div></label>
          <label htmlFor="authorized-confirm-password">Confirm Password<div className="admin-password-field"><input id="authorized-confirm-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={function (event) { setConfirmPassword(event.target.value); }} placeholder="Re-enter password" /><button type="button" onClick={function () { setShowConfirmPassword(!showConfirmPassword); }} aria-label="Show or hide confirm password">{showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}</button></div></label>
          <label htmlFor="authorized-position">Position / Sub-role<select id="authorized-position" value={subRole} onChange={function (event) { setSubRole(event.target.value); }}>{authorizedPositions.map(function (position) { return <option key={position} value={position}>{position}</option>; })}</select></label>
          <button className="admin-add-user-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating account..." : "Create Account"}</button>
          {message && <p className="admin-form-message admin-form-message--success">{message}</p>}
          {errorMessage && <p className="admin-form-message admin-form-message--error" role="alert">{errorMessage}</p>}
        </form>
      </div>
    </section>
  );
}
