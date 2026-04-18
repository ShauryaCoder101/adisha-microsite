import { useState, useEffect } from 'react';
import VideoCard from '../components/VideoCard';
import VideoModal from '../components/VideoModal';
import Loader from '../components/Loader';

export default function GamesVideosPage({ apiBase }) {
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
          <div className="page-banner-icon">🎮</div>
          <h1>Games Videos</h1>
          <p>
            Watch back the hilarious and competitive games played during the pre-engagement celebration!
          </p>
          <div className="page-banner-line"></div>
        </div>
      </section>

      {/* Video Grid */}
      <section className="section">
        <div className="container">
          {loading && <Loader text="Loading games videos..." />}

          {error && (
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <h3>Couldn't Load Videos</h3>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && snippets.length === 0 && (
            <div className="empty-state animate-fade-in">
              <div className="empty-state-icon">🎬</div>
              <h3>No Games Videos Yet</h3>
              <p>Games videos from the celebration will appear here once they've been uploaded. Check back soon!</p>
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
