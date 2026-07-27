import { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function SecurityLayout({ children, currentUser, userData, hideTitle, hideSubtitle }) {
  // Ini-store ang estado ng mobile sidebar.
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleMenu() {
    // Pinapalit ang estado kapag pinindot ang menu button.
    setMenuOpen(!menuOpen);
  }

  function closeMenu() {
    // Isinara ang sidebar kapag nag-click sa overlay o link.
    setMenuOpen(false);
  }

  function handleMainClick() {
    if (menuOpen) {
      closeMenu();
    }
  }

  return (
    <div className="container">
      <Sidebar role="security" isOpen={menuOpen} onClose={closeMenu} currentUser={currentUser} userData={userData} />
      <div className="main" onClick={handleMainClick}>
        <div className="content-body">{children}</div>
      </div>
    </div>
  );
}
