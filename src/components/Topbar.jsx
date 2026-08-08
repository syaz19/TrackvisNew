// Topbar component: maliit na header na ginagamit sa itaas ng mga page.
// Props:
// - title: pangunahing pamagat ng page
// - subtitle: maliit na subtitle na maaaring ipakita
// - onMenuToggle: callback kapag pina-toggle ang mobile menu
// - menuOpen: boolean kung bukas ang mobile menu
// - hideTitle/hideSubtitle: flag para itago ang title/subtitle
// - isSmallTitle: gamitin ang maliit na title style kung true
export default function Topbar({ title, subtitle, onMenuToggle, menuOpen, hideTitle, hideSubtitle, isSmallTitle }) {
  // placeholder para sa subtitle JSX kung ipapakita
  let subtitleBlock = null;

  // Kung may subtitle at hindi ito itinatago, i-build ang JSX block
  if (subtitle && !hideSubtitle) {
    subtitleBlock = <p className="topbar-subtitle">{subtitle}</p>;
  }

  // CSS class para gawing maliit ang title kapag kinakailangan
  const titleClass = isSmallTitle ? "topbar-title-small" : "";

  // Return ng JSX: button para sa mobile menu at title/subtitle
  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Mobile menu button: tatlong linya (hamburger) */}
        <button
          type="button"
          className="mobile-menu-button"
          onClick={onMenuToggle}
          aria-expanded={menuOpen}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          {/* Brand label sa kaliwa ng topbar */}
          <p className="topbar-label">TrackVis Professional</p>
          {/* Pahintulutan ang parent na itago ang title kapag hideTitle true */}
          {!hideTitle && <h2 className={titleClass}>{title}</h2>}
          {/* Ipakita ang subtitle block kung mayroon */}
          {subtitleBlock}
        </div>
      </div>
    </header>
  );
}
