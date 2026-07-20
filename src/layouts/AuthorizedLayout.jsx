import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function AuthorizedLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleMenu() {
    setMenuOpen(!menuOpen);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="container">
      <Sidebar role="authorized" isOpen={menuOpen} onClose={closeMenu} />
      <div className="main" onClick={() => menuOpen && closeMenu()}>
        <Topbar
          role="authorized"
          title="Authorized Personnel"
          subtitle="Review visitor assignments, confirmations, and notes."
          onMenuToggle={toggleMenu}
          menuOpen={menuOpen}
        />
        <div className="content-body">{children}</div>
      </div>
    </div>
  );
}
