import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";

// AccountPage:
// Ito ang page na nagpapakita ng profile ng kasalukuyang user.
// May mga button para mag-edit ng profile at mag-change ng password.
// Ang data ay kinukuha sa authenticated user at sa Firestore users document.
function getRoleLabel(role) {
  if (role === "security") return "Security";
  if (role === "authorized") return "Authorized";
  return "User";
}

export default function AccountPage({ currentUser, userData }) {
  // authenticatedUser: active user na naka-login.
  // Ito ang pinakaimportanteng source ng user info.
  const authenticatedUser = currentUser || auth.currentUser;

  // email: actual email ng logged-in user.
  const email = authenticatedUser?.email || userData?.email || "";

  // emailName: part bago ang @, ginagamit bilang fallback name kung walang display name.
  const emailName = email ? email.split("@")[0].trim() : "";

  // defaultName at activeDisplayName: ginagamit para ma-show ang current name sa page.
  const defaultName = userData?.name || authenticatedUser?.displayName || emailName || "User";
  const activeDisplayName = authenticatedUser?.displayName || userData?.name || emailName || "User";

  // savedProfile: data na naka-save na at visible sa page.
  // draftProfile: temporary copy ng data habang nag-eedit ang user.
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
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [showPasswordEditor, setShowPasswordEditor] = useState(false);

  // useEffect na ito: kapag magbago ang user data, i-update ang profile displays.
  // Hindi agad isusulat sa database ang edit; first, ino-update ang local draft state.
  useEffect(function () {
    const nextSavedProfile = {
      name: activeDisplayName,
      phoneNumber: userData?.phoneNumber || userData?.phone || "",
      address: userData?.address || "",
      age: userData?.age ? String(userData.age) : ""
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedProfile(nextSavedProfile);
    setDraftProfile(nextSavedProfile);
  }, [currentUser, userData, activeDisplayName]);

  // handleSubmit:
  // Ito ang function na tinatawag kapag nai-save na ang edited profile.
  // Una, i-validate ang input, tapos i-update sa Firebase Auth at sa Firestore.
  async function handleSubmit(event) {
    event.preventDefault();

    if (!auth.currentUser) {
      setError("User session is not available.");
      return;
    }

    const trimmedName = draftProfile.name.trim();
    const userEmail = currentUser?.email || userData?.email;
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

      if (trimmedName !== (authenticatedUser?.displayName || userData?.name || "")) {
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
      const messageText = submitError?.message || "Unable to update profile.";
      setError(messageText);
    } finally {
      setSaving(false);
    }
  }

  // handlePasswordSubmit:
  // Ito ang process para baguhin ang password.
  // Kailangan muna ang current password para ma-reauthenticate bago mag-update.
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
      setMessage("Password updated successfully.");
    } catch (submitError) {
      const messageText = submitError?.message || "Unable to update password.";

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

  const roleLabel = getRoleLabel(userData?.role || authenticatedUser?.role || "user");
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
                  <input
                    id="account-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={function (event) {
                      setCurrentPassword(event.target.value);
                    }}
                    placeholder="Enter your current password"
                  />
                </div>

                <div className="account-form__field account-form__field--full">
                  <label htmlFor="account-new-password">New Password</label>
                  <input
                    id="account-new-password"
                    type="password"
                    value={newPassword}
                    onChange={function (event) {
                      setNewPassword(event.target.value);
                    }}
                    placeholder="Enter your new password"
                  />
                </div>

                <div className="account-form__field account-form__field--full">
                  <label htmlFor="account-confirm-password">Confirm New Password</label>
                  <input
                    id="account-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={function (event) {
                      setConfirmPassword(event.target.value);
                    }}
                    placeholder="Confirm your new password"
                  />
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
