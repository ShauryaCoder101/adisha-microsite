import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const heroImages = [
  '/images/hero-1.jpg',
  '/images/hero-2.jpg',
  '/images/hero-3.jpg',
  '/images/hero-4.jpg',
  '/images/hero-5.jpg',
];

export default function HomePage() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="hero">
        {/* Slideshow background */}
        <div className="hero-slideshow">
          {heroImages.map((src, index) => (
            <div
              key={src}
              className={`hero-slide ${index === activeSlide ? 'active' : ''}`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
        </div>
        {/* Dark vignette overlay */}
        <div className="hero-vignette"></div>
        <div className="hero-content">
          <img
            src="/adisha-logo.png"
            alt="Adisha - Pre-Engagement Celebration"
            style={{
              height: '200px',
              width: 'auto',
              objectFit: 'contain',
              margin: '0 auto var(--space-lg)',
              animation: 'fadeInUp 0.6s ease-out',
              filter: 'drop-shadow(0 4px 24px rgba(0, 0, 0, 0.5))',
            }}
          />
          <p className="hero-subtitle" style={{ color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
            Relive the magic of the pre-engagement celebration. Find your photos, watch the fun, and cherish every moment.
          </p>
          <div className="hero-actions">
            <Link to="/photos" className="btn btn-primary btn-lg">
              Find My Photos →
            </Link>
            <Link to="/adisha" className="btn btn-secondary btn-lg">
              💑 Adisha Gallery
            </Link>
          </div>
        </div>
      </section>

      {/* Event Highlights */}
      <section className="section" style={{ background: 'var(--color-bg-secondary)' }}>
        <div className="container">
          <div className="section-header">
            <h2 className="heading-lg">
              Celebrate With Us — <span className="gradient-text">Adisha</span>
            </h2>
            <p style={{ maxWidth: '720px' }}>
              An evening filled with love, laughter, and unforgettable memories. Browse through your personal photos and relive every magical moment from our pre-engagement celebration.
            </p>
          </div>

          <div className="features-grid stagger-children">
            <Link to="/photos" className="feature-card glass-card" id="feature-photos">
              <div className="feature-icon">📸</div>
              <h3>Find Your Photos</h3>
              <p>Upload a selfie and our AI will find all event photos you appear in. Download your personal photo collection instantly.</p>
              <div className="feature-arrow">
                Find my photos →
              </div>
            </Link>

            <Link to="/adisha" className="feature-card glass-card" id="feature-adisha">
              <div className="feature-icon blue">💑</div>
              <h3>Adisha Gallery</h3>
              <p>Browse through all the beautiful photos of the lovely couple — Aditya & Disha — from the celebration night.</p>
              <div className="feature-arrow">
                View gallery →
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* About the Celebration */}
      <section className="section about-section">
        <div className="container">
          <div className="about-inner">
            <div className="about-logo">
              <img src="/adisha-logo.png" alt="Adisha" />
            </div>
            <div className="about-content">
              <h2>About This Celebration</h2>
              <p>
                This microsite is a special keepsake from Adisha's pre-engagement party — a joyous evening that brought together family and friends for an unforgettable night of celebrations. Find yourself in every moment and download your favourite memories.
              </p>
              <Link
                to="/photos"
                className="about-link"
              >
                Find your photos →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
