import { useState, useEffect } from 'react';
import Loader from '../components/Loader';

export default function AdishaPage({ apiBase }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const res = await fetch(`${apiBase}/api/couple/photos`);
      const data = await res.json();
      if (data.success) {
        setPhotos(data.photos || []);
      } else {
        setError(data.message || 'Failed to load photos');
      }
    } catch (err) {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (url, filename) => {
    try {
      const res = await fetch(url.startsWith('http') ? url : `${apiBase}${url}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || 'photo.jpg';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleDownloadAll = async () => {
    for (const photo of photos) {
      await handleDownload(photo.url, photo.filename);
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const openLightbox = (index) => setLightbox(index);
  const closeLightbox = () => setLightbox(null);
  const nextPhoto = () => setLightbox((prev) => (prev + 1) % photos.length);
  const prevPhoto = () => setLightbox((prev) => (prev - 1 + photos.length) % photos.length);

  return (
    <>
      {/* Page Banner */}
      <section className="page-banner">
        <div className="container">
          <div className="page-banner-icon gold">💑</div>
          <h1>
            <span className="gradient-text">Adisha</span> — The Exquisite Couple
          </h1>
          <p>
            Every beautiful moment of Aditya & Disha from the pre-engagement celebration, captured forever.
          </p>
          <div className="page-banner-line"></div>
        </div>
      </section>

      {/* Main Content */}
      <section className="section">
        <div className="container">
          {loading && <Loader text="Loading couple's photo gallery..." />}

          {error && (
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <h3>Something went wrong</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && photos.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">💑</div>
              <h3>Gallery Coming Soon</h3>
              <p>The couple's photo gallery will be available shortly. Stay tuned!</p>
            </div>
          )}

          {!loading && photos.length > 0 && (
            <div className="animate-fade-in-up">
              <div className="results-header">
                <div>
                  <h2 className="heading-md">
                    {photos.length} beautiful moment{photos.length === 1 ? '' : 's'} 💕
                  </h2>
                  <p className="text-muted" style={{ marginTop: 'var(--space-xs)' }}>
                    Click any photo to view full size · All photos matched using AI
                  </p>
                </div>
                <div className="results-header-actions">
                  <button className="btn btn-gold" onClick={handleDownloadAll} id="download-all-couple">
                    ⬇ Download All
                  </button>
                </div>
              </div>

              <div className="photo-grid stagger-children" id="adisha-gallery">
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="photo-card"
                    onClick={() => openLightbox(index)}
                    id={`couple-photo-${photo.id}`}
                  >
                    <img
                      src={photo.url.startsWith('http') ? photo.url : `${apiBase}${photo.url}`}
                      alt={photo.filename}
                      loading="lazy"
                    />
                    <div className="photo-card-overlay">
                      <div className="photo-card-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(photo.url, photo.filename);
                          }}
                        >
                          ⬇ Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>✕</button>
            <button className="lightbox-nav lightbox-prev" onClick={prevPhoto}>‹</button>
            <img
              src={photos[lightbox].url.startsWith('http') ? photos[lightbox].url : `${apiBase}${photos[lightbox].url}`}
              alt={photos[lightbox].filename}
            />
            <button className="lightbox-nav lightbox-next" onClick={nextPhoto}>›</button>
            <div className="lightbox-footer">
              <span>{lightbox + 1} / {photos.length}</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleDownload(photos[lightbox].url, photos[lightbox].filename)}
              >
                ⬇ Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
