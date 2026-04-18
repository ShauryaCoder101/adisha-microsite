import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-brand">
            <img
              src="/adisha-logo.png"
              alt="Adisha"
              style={{
                height: '50px',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>
          <div className="footer-text">
            Made with ❤️ for Adisha's Pre-Engagement Celebration
          </div>
          <div className="footer-links">
            <Link to="/photos">
              My Photos
            </Link>
            <Link to="/admin">
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
