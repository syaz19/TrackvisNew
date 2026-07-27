import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function AuthorizedLayout({ children, currentUser, userData, hideTitle, hideSubtitle, isSmallTitle, title }) {
  // Ini-store ang kalagayan ng menu para sa mobile view.
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleMenu() {
    // Pinapalit ang estado ng menu sa bawat click.
    setMenuOpen(!menuOpen);
  }

  function closeMenu() {
    // Isinara ang menu kapag pinindot ang overlay o link.
    setMenuOpen(false);
  }

  function handleMainClick() {
    if (menuOpen) {
      closeMenu();
    }
  }

  return (
    <div className="container">
      <Sidebar role="authorized" isOpen={menuOpen} onClose={closeMenu} currentUser={currentUser} userData={userData} />
      <div className="main" onClick={handleMainClick}>
        <Topbar
          role="authorized"
          title={title || "AUTHORIZED PERSONNEL"}
          onMenuToggle={toggleMenu}
          menuOpen={menuOpen}
          currentUser={currentUser}
          userData={userData}
          hideTitle={hideTitle}
          hideSubtitle={hideSubtitle}
          isSmallTitle={isSmallTitle}
        />
        <div className="content-body">{children}</div>
      </div>
    </div>
  );
}
