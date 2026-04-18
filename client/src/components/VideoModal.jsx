import { useEffect, useRef } from 'react';

export default function VideoModal({ snippet, onClose }) {
  const overlayRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  if (!snippet) return null;

  return (
    <div 
      className="video-modal-overlay" 
      ref={overlayRef} 
      onClick={handleOverlayClick}
    >
      <div className="video-modal">
        <div className="video-modal-header">
          <h3>{snippet.title}</h3>
          <button className="video-modal-close" onClick={onClose}>✕</button>
        </div>
        <video 
          ref={videoRef}
          src={snippet.videoUrl} 
          controls 
          autoPlay 
          controlsList="nodownload"
          style={{ width: '100%', display: 'block', background: '#000' }}
        />
        <div className="video-modal-info">
          {snippet.speakerName && (
            <p style={{ marginBottom: '0.5rem', color: 'var(--color-accent-primary)', fontWeight: 600 }}>
              🎤 {snippet.speakerName}
            </p>
          )}
          <p>{snippet.description}</p>
        </div>
      </div>
    </div>
  );
}
