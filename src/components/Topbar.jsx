
export default function Topbar({ title, subtitle, onMenuToggle, menuOpen, hideTitle, hideSubtitle, isSmallTitle }) {
  let subtitleBlock = null;

  if (subtitle && !hideSubtitle) {
    subtitleBlock = <p className="topbar-subtitle">{subtitle}</p>;
  }

  
  const titleClass = isSmallTitle ? "topbar-title-small" : "";

  
  return (
    <header className="topbar">
      <div className="topbar-left">
        {}
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
          {}
          <p className="topbar-label">TrackVis Professional</p>
          {}
          {!hideTitle && <h2 className={titleClass}>{title}</h2>}
          {}
          {subtitleBlock}
        </div>
      </div>
    </header>
  );
}
