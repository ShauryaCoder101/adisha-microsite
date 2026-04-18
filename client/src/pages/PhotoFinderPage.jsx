import { useState, useRef, useCallback } from 'react';
import Loader from '../components/Loader';

export default function PhotoFinderPage({ apiBase }) {
  const [selfie, setSelfie] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, WebP)');
      return;
    }
    setSelfie(file);
    setSelfiePreview(URL.createObjectURL(file));
    setError(null);
    setSearched(false);
    setMatches([]);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleSearch = async () => {
    if (!selfie) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('selfie', selfie);

      const res = await fetch(`${apiBase}/api/face-search`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setMatches(data.matches || []);
      setSearched(true);
    } catch (err) {
      setError(err.message);
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
    for (const photo of matches) {
      await handleDownload(photo.url, photo.filename);
      // Small delay between downloads to prevent browser throttling
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const resetSearch = () => {
    setSelfie(null);
    setSelfiePreview(null);
    setMatches([]);
    setSearched(false);
    setError(null);
  };

  return (
    <>
      {/* Page Banner */}
      <section className="page-banner">
        <div className="container">
          <div className="page-banner-icon">📸</div>
          <h1>Find Your Celebration Photos</h1>
          <p>
            Upload a photo of yourself and we'll find all the party photos you appear in!
          </p>
          <p className="banner-secondary">
            Our AI-powered photo matching will scan through all celebration photos to find your best moments.
          </p>
          <div className="page-banner-line"></div>
        </div>
      </section>

      {/* Main Content */}
      <section className="section">
        <div className="container">

          {/* Upload Zone */}
          {!searched && (
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div
                className={`upload-zone ${dragOver ? 'drag-over' : ''} ${selfiePreview ? 'scan-animation' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !selfie && fileInputRef.current?.click()}
                style={selfiePreview ? { cursor: 'default' } : undefined}
                id="upload-selfie-zone"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />

                {selfiePreview ? (
                  <div style={{ position: 'relative' }}>
                    <img src={selfiePreview} alt="Your selfie" className="upload-preview" />
                    <p style={{ marginTop: 'var(--space-md)', color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                      ✓ Photo ready for search
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="upload-zone-icon">🤳</div>
                    <h3>Drop your photo here</h3>
                    <p>or click to browse • JPG, PNG, WebP up to 10MB</p>
                  </>
                )}
              </div>

              {error && (
                <div style={{
                  marginTop: 'var(--space-md)',
                  padding: 'var(--space-md) var(--space-lg)',
                  background: 'rgba(184, 57, 75, 0.1)',
                  border: '1px solid rgba(184, 57, 75, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-accent-rose)',
                  fontSize: '0.9rem',
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', marginTop: 'var(--space-xl)' }}>
                {selfie && (
                  <>
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={handleSearch}
                      disabled={loading}
                      id="search-faces-btn"
                    >
                      {loading ? '🔍 Searching...' : 'Find My Photos →'}
                    </button>
                    <button className="btn btn-secondary" onClick={resetSearch}>
                      Change Photo
                    </button>
                  </>
                )}
              </div>

              {loading && <Loader text="Scanning celebration photos with AI facial recognition..." />}
            </div>
          )}

          {/* Results */}
          {searched && (
            <div className="animate-fade-in-up">
              <div className="results-header">
                <div>
                  <h2 className="heading-md">
                    {matches.length > 0
                      ? `Found ${matches.length} photo${matches.length === 1 ? '' : 's'} of you! 🎉`
                      : 'No matches found'}
                  </h2>
                  <p className="text-muted" style={{ marginTop: 'var(--space-xs)' }}>
                    {matches.length > 0
                      ? 'Click on any photo to download · Photos matched using facial recognition'
                      : 'Try uploading a clearer photo for better results'}
                  </p>
                </div>
                <div className="results-header-actions">
                  {matches.length > 0 && (
                    <button className="btn btn-gold" onClick={handleDownloadAll} id="download-all-btn">
                      ⬇ Download All
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={resetSearch}>
                    ← Try Another Photo
                  </button>
                </div>
              </div>

              {matches.length > 0 ? (
                <div className="photo-grid stagger-children">
                  {matches.map((photo) => (
                    <div key={photo.id} className="photo-card" id={`photo-${photo.id}`}>
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
                          <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
                            {photo.confidence}% match
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <h3>No Matching Photos</h3>
                  <p>We couldn't find any celebration photos matching your face. Try a different, clearer photo with good lighting.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
