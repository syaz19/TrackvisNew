import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function AuthorizedLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="container">
      <Sidebar role="authorized" isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main" onClick={() => menuOpen && setMenuOpen(false)}>
        <Topbar
          role="authorized"
          title="Authorized Personnel"
          subtitle="Review visitor assignments, confirmations, and notes."
          onMenuToggle={() => setMenuOpen((prev) => !prev)}
          menuOpen={menuOpen}
        />
        {children}
      </div>
    </div>
  );
}
