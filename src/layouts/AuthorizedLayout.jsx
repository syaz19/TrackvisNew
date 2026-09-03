
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";


export default function AuthorizedLayout({ children, currentUser, userData, hideTitle, hideSubtitle, isSmallTitle, title }) {
  
  const [menuOpen, setMenuOpen] = useState(false);

  
  function toggleMenu() {
    setMenuOpen(!menuOpen);
  }

  
  function closeMenu() {
    setMenuOpen(false);
  }

  
  function handleMainClick() {
    if (menuOpen) {
      closeMenu();
    }
  }

  let pageTitle = title;

  if (!pageTitle) {
    pageTitle = "AUTHORIZED PERSONNEL";
  }

  
  return (
    <div className="container authorized-container">
      <Sidebar role="authorized" isOpen={menuOpen} onClose={closeMenu} currentUser={currentUser} userData={userData} />
      <div className="main" onClick={handleMainClick}>
        <Topbar
          role="authorized"
          title={pageTitle}
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
