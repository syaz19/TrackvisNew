import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function SecurityLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleMenu() {
    setMenuOpen(!menuOpen);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="container">
      <Sidebar role="security" isOpen={menuOpen} onClose={closeMenu} />
      <div className="main" onClick={() => menuOpen && closeMenu()}>
        <Topbar
          role="security"
          title="Security Operations"
          subtitle="Monitor active visitors, violations, and daily progress."
          onMenuToggle={toggleMenu}
          menuOpen={menuOpen}
        />
        <div className="content-body">{children}</div>
      </div>
    </div>
  );
}
