import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const links = [
    { to: '/', label: 'Home' },
    { to: '/adisha', label: 'Adisha' },
    { to: '/photos', label: 'My Photos' },
  ];

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <img
            src="/adisha-logo.png"
            alt="Adisha - Pre-Engagement Celebration"
            style={{
              height: '70px',
              width: 'auto',
              objectFit: 'contain',
            }}
          />
        </Link>

        <ul className="navbar-links" style={mobileOpen ? {
          display: 'flex',
          flexDirection: 'column',
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'rgba(255, 251, 245, 0.98)',
          backdropFilter: 'blur(20px)',
          padding: '1.5rem',
          borderBottom: '1px solid var(--color-border)',
          gap: '1rem',
          boxShadow: '0 8px 32px rgba(92,26,51,0.08)',
        } : undefined}>
          {links.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className={location.pathname === link.to ? 'active' : ''}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <button
          className="navbar-mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
}
