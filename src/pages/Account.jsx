import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { Eye, EyeOff } from "lucide-react";


function getRoleLabel(role) {
  if (role === "security") return "Security";
  if (role === "authorized") return "Authorized";
  return "User";
}

export default function AccountPage({ currentUser, userData }) {
  const navigate = useNavigate();

  
  const authenticatedUser = currentUser || auth.currentUser;

  
  const email = authenticatedUser && authenticatedUser.email
    ? authenticatedUser.email
    : userData && userData.email
      ? userData.email
      : "";

  
  const emailName = email ? email.split("@")[0].trim() : "";

  
  const defaultName = userData && userData.name
    ? userData.name
    : authenticatedUser && authenticatedUser.displayName
      ? authenticatedUser.displayName
      : emailName || "User";
  const activeDisplayName = authenticatedUser && authenticatedUser.displayName
    ? authenticatedUser.displayName
    : userData && userData.name
      ? userData.name
      : emailName || "User";

  
  const [savedProfile, setSavedProfile] = useState({
    name: defaultName,
    phoneNumber: "",
    address: "",
    age: ""
  });
  const [draftProfile, setDraftProfile] = useState({
    name: defaultName,
    phoneNumber: "",
    address: "",
    age: ""
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [showPasswordEditor, setShowPasswordEditor] = useState(false);

  function getPasswordIcon(isVisible) {
    if (isVisible) {
      return <Eye size={20} />;
    }

    return <EyeOff size={20} />;
  }

  function getPasswordType(isVisible) {
    if (isVisible) {
      return "text";
    }

    return "password";
  }

  function handleCurrentPasswordToggle() {
    setShowCurrentPassword(!showCurrentPassword);
  }

  function handleNewPasswordToggle() {
    setShowNewPassword(!showNewPassword);
  }

  function handleConfirmPasswordToggle() {
    setShowConfirmPassword(!showConfirmPassword);
  }

  
  useEffect(function () {
    const nextSavedProfile = {
      name: activeDisplayName,
      phoneNumber: userData && (userData.phoneNumber || userData.phone) || "",
      address: userData && userData.address || "",
      age: userData && userData.age ? String(userData.age) : ""
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedProfile(nextSavedProfile);
    setDraftProfile(nextSavedProfile);
  }, [currentUser, userData, activeDisplayName]);

  
  async function handleSubmit(event) {
    event.preventDefault();

    if (!auth.currentUser) {
      setError("User session is not available.");
      return;
    }

    const trimmedName = draftProfile.name.trim();
    const userEmail = currentUser && currentUser.email || userData && userData.email;
    const normalizedPhone = draftProfile.phoneNumber.trim();
    const normalizedAddress = draftProfile.address.trim();
    const numericAge = draftProfile.age.trim();

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    if (numericAge && Number.isNaN(Number(numericAge))) {
      setError("Age must be a valid number.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const oldDisplayName = authenticatedUser && authenticatedUser.displayName || userData && userData.name || "";

      if (trimmedName !== oldDisplayName) {
        await updateProfile(auth.currentUser, {
          displayName: trimmedName
        });
      }

      if (userEmail) {
        await updateDoc(doc(db, "users", userEmail), {
          name: trimmedName,
          phoneNumber: normalizedPhone,
          address: normalizedAddress,
          age: numericAge ? Number(numericAge) : ""
        });
      }

      const nextSavedProfile = {
        name: trimmedName,
        phoneNumber: normalizedPhone,
        address: normalizedAddress,
        age: numericAge
      };

      setSavedProfile(nextSavedProfile);
      setDraftProfile(nextSavedProfile);
      setMessage("Profile updated successfully.");
      setShowEditor(false);
    } catch (submitError) {
      const messageText = submitError && submitError.message || "Unable to update profile.";
      setError(messageText);
    } finally {
      setSaving(false);
    }
  }

  
  async function handlePasswordSubmit(event) {
    event.preventDefault();

    if (!auth.currentUser) {
      setError("User session is not available.");
      return;
    }

    if (!currentPassword.trim()) {
      setError("Current password is required.");
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError("Please enter both the new password and confirm password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword.trim());
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword.trim());

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordEditor(false);

      window.alert("You need to relog in to continue.");
      await signOut(auth);
      navigate("/", { replace: true });
    } catch (submitError) {
      const messageText = submitError && submitError.message || "Unable to update password.";

      if (messageText.includes("requires-recent-login") || messageText.includes("recent login")) {
        setError("Please sign out and sign back in before changing your password.");
        return;
      }

      if (messageText.includes("wrong-password") || messageText.includes("password is invalid")) {
        setError("Current password is incorrect.");
        return;
      }

      setError(messageText);
    } finally {
      setSaving(false);
    }
  }

  const role = userData && userData.role || authenticatedUser && authenticatedUser.role || "user";
  const roleLabel = getRoleLabel(role);
  const profileInitial = (savedProfile.name.trim() || emailName || "U").charAt(0).toUpperCase();
  const accountDisplayName = savedProfile.name.trim() || emailName || "User";
  const summaryFields = [
    { label: "Name", value: accountDisplayName },
    { label: "Role", value: roleLabel || "User" },
    { label: "Email", value: email },
    { label: "Phone Number", value: savedProfile.phoneNumber || "No phone number yet" },
    { label: "Age", value: savedProfile.age || "No age yet" },
    { label: "Address", value: savedProfile.address || "No address yet" }
  ];

  return (
    <div className="account-page-shell">
      <div className="account-page">
        <div className="account-panel">
          <div className="account-profile-block">
            <div className="account-profile-avatar">{profileInitial}</div>
            <div className="account-profile-meta">
              <p className="account-profile-name">Welcome {accountDisplayName}</p>
              <p className="account-profile-role">{roleLabel}</p>
              <p className="account-profile-email">{email}</p>
            </div>
          </div>

          {!showEditor && !showPasswordEditor && (
            <div className="account-summary">
              <div className="account-summary__header">
                <h3>Profile Details</h3>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button type="button" className="btn-outline account-edit-button" onClick={function () {
                    setShowEditor(true);
                    setShowPasswordEditor(false);
                    setError("");
                    setMessage("");
                  }}>
                    Edit Profile
                  </button>
                  <button type="button" className="btn-outline account-edit-button" onClick={function () {
                    setShowPasswordEditor(true);
                    setShowEditor(false);
                    setError("");
                    setMessage("");
                  }}>
                    Change Password
                  </button>
                </div>
              </div>

              <div className="account-summary__grid">
                {summaryFields.map(function (field) {
                  return (
                    <div key={field.label} className="account-detail-item">
                      <span className="account-detail-label">{field.label}</span>
                      <strong className="account-detail-value">{field.value}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showEditor && (
            <form className="account-form" onSubmit={handleSubmit}>
              <div className="account-form__header">
                <h3>Edit Profile</h3>
                <button type="button" className="btn-outline account-cancel-button" onClick={function () {
                  setDraftProfile(savedProfile);
                  setShowEditor(false);
                  setError("");
                  setMessage("");
                }}>
                  Cancel
                </button>
              </div>

              <div className="account-form__grid">
                <div className="account-form__field">
                  <label htmlFor="account-name">Name</label>
                  <input
                    id="account-name"
                    type="text"
                    value={draftProfile.name}
                    onChange={function (event) {
                      setDraftProfile(function (current) {
                        return { ...current, name: event.target.value };
                      });
                    }}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="account-form__field">
                  <label htmlFor="account-email">Email</label>
                  <input id="account-email" type="email" value={email} disabled readOnly />
                </div>

                <div className="account-form__field">
                  <label htmlFor="account-phone">Phone Number</label>
                  <input
                    id="account-phone"
                    type="tel"
                    value={draftProfile.phoneNumber}
                    onChange={function (event) {
                      setDraftProfile(function (current) {
                        return { ...current, phoneNumber: event.target.value };
                      });
                    }}
                    placeholder="No phone number yet"
                  />
                </div>

                <div className="account-form__field">
                  <label htmlFor="account-age">Age</label>
                  <input
                    id="account-age"
                    type="number"
                    min="1"
                    value={draftProfile.age}
                    onChange={function (event) {
                      setDraftProfile(function (current) {
                        return { ...current, age: event.target.value };
                      });
                    }}
                    placeholder="No age yet"
                  />
                </div>

                <div className="account-form__field account-form__field--full">
                  <label htmlFor="account-address">Address</label>
                  <input
                    id="account-address"
                    type="text"
                    value={draftProfile.address}
                    onChange={function (event) {
                      setDraftProfile(function (current) {
                        return { ...current, address: event.target.value };
                      });
                    }}
                    placeholder="No address yet"
                  />
                </div>
              </div>

              {error && <p className="account-feedback account-feedback--error">{error}</p>}
              {message && <p className="account-feedback account-feedback--success">{message}</p>}

              <button type="submit" className="btn-primary account-submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}

          {showPasswordEditor && (
            <form className="account-form" onSubmit={handlePasswordSubmit}>
              <div className="account-form__header">
                <h3>Change Password</h3>
                <button type="button" className="btn-outline account-cancel-button" onClick={function () {
                  setShowPasswordEditor(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setError("");
                  setMessage("");
                }}>
                  Cancel
                </button>
              </div>

              <div className="account-form__grid">
                <div className="account-form__field account-form__field--full">
                  <label htmlFor="account-current-password">Current Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="account-current-password"
                      type={getPasswordType(showCurrentPassword)}
                      value={currentPassword}
                      onChange={function (event) {
                        setCurrentPassword(event.target.value);
                      }}
                      placeholder="Enter your current password"
                      style={{ paddingRight: "52px" }}
                    />
                    <button type="button" onClick={handleCurrentPasswordToggle} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#cbd5e1", cursor: "pointer", padding: "6px" }} aria-label="Show or hide current password">
                      {getPasswordIcon(showCurrentPassword)}
                    </button>
                  </div>
                </div>

                <div className="account-form__field account-form__field--full">
                  <label htmlFor="account-new-password">New Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="account-new-password"
                      type={getPasswordType(showNewPassword)}
                      value={newPassword}
                      onChange={function (event) {
                        setNewPassword(event.target.value);
                      }}
                      placeholder="Enter your new password"
                      style={{ paddingRight: "52px" }}
                    />
                    <button type="button" onClick={handleNewPasswordToggle} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#cbd5e1", cursor: "pointer", padding: "6px" }} aria-label="Show or hide new password">
                      {getPasswordIcon(showNewPassword)}
                    </button>
                  </div>
                </div>

                <div className="account-form__field account-form__field--full">
                  <label htmlFor="account-confirm-password">Confirm New Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="account-confirm-password"
                      type={getPasswordType(showConfirmPassword)}
                      value={confirmPassword}
                      onChange={function (event) {
                        setConfirmPassword(event.target.value);
                      }}
                      placeholder="Confirm your new password"
                      style={{ paddingRight: "52px" }}
                    />
                    <button type="button" onClick={handleConfirmPasswordToggle} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#cbd5e1", cursor: "pointer", padding: "6px" }} aria-label="Show or hide confirm password">
                      {getPasswordIcon(showConfirmPassword)}
                    </button>
                  </div>
                </div>
              </div>

              {error && <p className="account-feedback account-feedback--error">{error}</p>}
              {message && <p className="account-feedback account-feedback--success">{message}</p>}

              <button type="submit" className="btn-primary account-submit" disabled={saving}>
                {saving ? "Saving..." : "Save Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
