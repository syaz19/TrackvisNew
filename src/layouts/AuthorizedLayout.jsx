// AuthorizedLayout: layout wrapper para sa mga routes ng authorized personnel
// Naglalaman ng Sidebar (navigation) at Topbar (header) at isang content area para sa children
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

// Props:
// - children: ang page content na ipapakita sa loob ng layout
// - currentUser / userData: user context mula sa Firebase Auth / Firestore
// - hideTitle/hideSubtitle/isSmallTitle/title: props para i-customize ang Topbar
export default function AuthorizedLayout({ children, currentUser, userData, hideTitle, hideSubtitle, isSmallTitle, title }) {
  // state kung naka-open ang mobile menu (used by Sidebar/Topbar)
  const [menuOpen, setMenuOpen] = useState(false);

  // Toggle function para sa mobile menu button
  function toggleMenu() {
    setMenuOpen(!menuOpen);
  }

  // Isara ang menu (ginagamit kapag nag-click sa overlay o link)
  function closeMenu() {
    setMenuOpen(false);
  }

  // Kapag nag-click sa main content at bukas ang menu, isara ito
  function handleMainClick() {
    if (menuOpen) {
      closeMenu();
    }
  }

  // Render ng layout: Sidebar + Topbar + content area
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
