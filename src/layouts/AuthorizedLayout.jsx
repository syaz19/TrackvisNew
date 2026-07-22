import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function AuthorizedLayout({ children }) {
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
      <Sidebar role="authorized" isOpen={menuOpen} onClose={closeMenu} />
      <div className="main" onClick={handleMainClick}>
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
