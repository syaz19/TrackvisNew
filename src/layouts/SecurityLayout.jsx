// SecurityLayout: layout wrapper para sa security staff pages
// Nagpo-provide ng Sidebar (role=security) at Topbar na naka-configure para sa security
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function SecurityLayout({ children, currentUser, userData, hideTitle, hideSubtitle, isSmallTitle, title }) {
  // state para sa mobile sidebar open/close
  const [menuOpen, setMenuOpen] = useState(false);

  // Toggle handler para sa topbar mobile menu button
  function toggleMenu() {
    setMenuOpen(!menuOpen);
  }

  // Isara ang menu (ginagamit bilang callback ng Sidebar at overlay)
  function closeMenu() {
    setMenuOpen(false);
  }

  // Kapag nag-click sa main content area at bukas ang menu, isara ito
  function handleMainClick() {
    if (menuOpen) {
      closeMenu();
    }
  }

  // Render: Sidebar (security) + Topbar + content
  return (
    <div className="container">
      <Sidebar role="security" isOpen={menuOpen} onClose={closeMenu} currentUser={currentUser} userData={userData} />
      <div className="main" onClick={handleMainClick}>
        <Topbar
          role="security"
          title={title || "SECURITY PERSONNEL"}
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
