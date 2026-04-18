export default function VideoCard({ snippet, onClick }) {
  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const placeholderThumb = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect fill="#2D1420" width="640" height="360"/>
      <text fill="#9B7E88" font-family="sans-serif" font-size="48" x="50%" y="50%" text-anchor="middle" dy=".35em">▶</text>
    </svg>
  `)}`;

  return (
    <div className="video-card" onClick={() => onClick?.(snippet)} id={`snippet-${snippet.id}`}>
      <div className="video-card-thumb">
        <img 
          src={snippet.thumbnailUrl || placeholderThumb} 
          alt={snippet.title}
          onError={(e) => { e.target.src = placeholderThumb; }}
        />
        <div className="video-card-play">
          <div className="video-card-play-btn">▶</div>
        </div>
        <div className="video-card-duration">
          {formatDuration(snippet.durationSeconds)}
        </div>
      </div>
      <div className="video-card-body">
        <span className={`badge ${snippet.type === 'keynote' ? 'badge-accent' : 'badge-purple'} video-card-type`}>
          {snippet.type === 'keynote' ? '🎮 Game' : '💃 Dance'}
        </span>
        <h4 className="video-card-title">{snippet.title}</h4>
        <p className="video-card-desc">{snippet.description}</p>
        {snippet.speakerName && (
          <div className="video-card-speaker">
            <div className="video-card-speaker-avatar">
              {getInitials(snippet.speakerName)}
            </div>
            <span>{snippet.speakerName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
