import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

export default function SecurityLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="container">
      <Sidebar role="security" isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main" onClick={() => menuOpen && setMenuOpen(false)}>
        <Topbar
          role="security"
          title="Security Operations"
          subtitle="Monitor active visitors, violations, and daily progress."
          onMenuToggle={() => setMenuOpen((prev) => !prev)}
          menuOpen={menuOpen}
        />
        {children}
      </div>
    </div>
  );
}
