import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import VideoModal from '../components/VideoModal';
import Loader from '../components/Loader';

export default function KeynotePage({ apiBase }) {
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSnippet, setSelectedSnippet] = useState(null);

  useEffect(() => {
    fetchSnippets();
  }, []);

  const fetchSnippets = async () => {
    try {
      const res = await fetch(`${apiBase}/api/snippets?type=keynote`);
      const data = await res.json();
      setSnippets(data.snippets || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Page Banner */}
      <section className="page-banner">
        <div className="container">
          <div className="page-banner-icon">🎤</div>
          <h1>Keynote Speaker Videos</h1>
          <p>
            Catch up on key insights from our keynote speakers.
          </p>
          <div className="page-banner-line"></div>
        </div>
      </section>

      {/* Video Grid */}
      <section className="section">
        <div className="container">
          {loading && <Loader text="Loading keynote snippets..." />}

          {error && (
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <h3>Couldn't Load Snippets</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && snippets.length === 0 && (
            <div className="empty-state animate-fade-in">
              <div className="empty-state-icon">🎬</div>
              <h3>No Keynote Videos Yet</h3>
              <p>Keynote video snippets will appear here once they've been processed. Check back soon!</p>
            </div>
          )}

          {snippets.length > 0 && (
            <div className="video-grid stagger-children">
              {snippets.map((snippet) => (
                <VideoCard
                  key={snippet.id}
                  snippet={snippet}
                  onClick={setSelectedSnippet}
                />
              ))}
            </div>
          )}

          {selectedSnippet && (
            <VideoModal
              snippet={{
                ...selectedSnippet,
                videoUrl: selectedSnippet.videoUrl?.startsWith('http')
                  ? selectedSnippet.videoUrl
                  : `${apiBase}${selectedSnippet.videoUrl}`,
              }}
              onClose={() => setSelectedSnippet(null)}
            />
          )}
        </div>
      </section>
    </>
  );
}
