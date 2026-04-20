import { useState, useEffect, useRef, useCallback } from 'react';
import Loader from '../components/Loader';

export default function AdminPage({ apiBase }) {
  const [status, setStatus] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState('');
  const [videoProgress, setVideoProgress] = useState('');
  const [logs, setLogs] = useState([]);
  const [coupleProfiles, setCoupleProfiles] = useState([]);
  const [profileUploading, setProfileUploading] = useState(null);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const adityaInputRef = useRef(null);
  const dishaInputRef = useRef(null);

  const addLog = useCallback((msg) => {
    setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg }].slice(-20));
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchCoupleProfiles();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/status`);
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      // Server probably not running
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setPhotoUploading(true);
    addLog(`📸 Starting upload of ${files.length} photos...`);

    const BATCH_SIZE = 25;
    let totalProcessed = 0;
    let totalFaces = 0;
    let failedBatches = 0;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(files.length / BATCH_SIZE);

      setPhotoProgress(`Uploading batch ${batchNum}/${totalBatches} (${totalProcessed}/${files.length} done)...`);

      try {
        const formData = new FormData();
        batch.forEach((f) => formData.append('photos', f));

        const res = await fetch(`${apiBase}/api/admin/upload-photos`, {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (data.success) {
          totalProcessed += data.processed;
          totalFaces += data.results.reduce((sum, r) => sum + r.facesIndexed, 0);
          addLog(`✅ Batch ${batchNum}: ${data.processed} photos, ${data.results.reduce((sum, r) => sum + r.facesIndexed, 0)} faces`);
        } else {
          failedBatches++;
          addLog(`❌ Batch ${batchNum} failed: ${data.error}`);
        }
      } catch (err) {
        failedBatches++;
        addLog(`❌ Batch ${batchNum} failed: ${err.message}`);
      }
    }

    const summary = `✅ ${totalProcessed}/${files.length} photos uploaded, ${totalFaces} faces indexed${failedBatches ? ` (${failedBatches} batches failed)` : ''}`;
    setPhotoProgress(summary);
    addLog(summary);
    setPhotoUploading(false);
    fetchStatus();
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoUploading(true);
    setVideoProgress(`Uploading ${file.name}...`);
    addLog(`🎬 Uploading video: ${file.name}`);

    try {
      const formData = new FormData();
      formData.append('video', file);

      const res = await fetch(`${apiBase}/api/admin/upload-video`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setVideoProgress(`✅ Uploaded! Processing in background (ID: ${data.videoId.slice(0, 8)}...)`);
        addLog(`✅ Video uploaded. Processing started for ${file.name}`);
        addLog(`ℹ️ Pipeline: Transcription → AI Analysis → Clip Extraction`);
      } else {
        setVideoProgress(`❌ Error: ${data.error}`);
        addLog(`❌ Video upload error: ${data.error}`);
      }
    } catch (err) {
      setVideoProgress(`❌ Upload failed: ${err.message}`);
      addLog(`❌ Video upload failed: ${err.message}`);
    } finally {
      setVideoUploading(false);
      fetchStatus();
    }
  };

  const initCollection = async () => {
    addLog('🔧 Initializing Rekognition collection...');
    try {
      const res = await fetch(`${apiBase}/api/admin/init-collection`, { method: 'POST' });
      const data = await res.json();
      addLog(data.success ? '✅ Collection ready' : `❌ ${data.error}`);
    } catch (err) {
      addLog(`❌ Failed: ${err.message}`);
    }
  };

  const fetchCoupleProfiles = async () => {
    try {
      const res = await fetch(`${apiBase}/api/couple/profiles`);
      const data = await res.json();
      setCoupleProfiles(data.profiles || []);
    } catch (err) {
      // Server not running
    }
  };

  const handleProfileUpload = async (e, name) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfileUploading(name);
    addLog(`💑 Uploading ${name}'s profile photo...`);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('selfie', file);

      const res = await fetch(`${apiBase}/api/couple/set-profile`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        addLog(`✅ ${data.message}`);
        fetchCoupleProfiles();
      } else {
        addLog(`❌ ${name} profile error: ${data.error}`);
      }
    } catch (err) {
      addLog(`❌ ${name} profile failed: ${err.message}`);
    } finally {
      setProfileUploading(null);
    }
  };

  const getStatusColor = (s) => {
    const colors = {
      uploaded: 'uploaded',
      transcribing: 'processing',
      analyzing: 'processing',
      trimming: 'processing',
      complete: 'complete',
      error: 'error',
    };
    return colors[s] || 'uploaded';
  };

  const getSelfieUrl = (id) => {
    const profile = coupleProfiles.find(p => p.id === id);
    if (!profile?.selfiePath) return '';
    return profile.selfiePath.startsWith('http') ? profile.selfiePath : `${apiBase}${profile.selfiePath}`;
  };

  return (
    <section className="section" style={{ paddingTop: '120px' }}>
      <div className="container">
        <div className="section-header animate-fade-in-up">
          <span className="badge badge-blue">🔧 Admin</span>
          <h1 className="heading-lg">Admin Dashboard</h1>
          <p>Upload event photos and videos — AI handles the rest</p>
        </div>

        {/* Service Status */}
        {status && (
          <div className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Service Status
            </h3>
            <div style={{ display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap' }}>
              {Object.entries(status.services || {}).map(([name, active]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span className={`status-dot ${active ? 'complete' : ''}`}
                    style={!active ? { background: 'var(--color-text-muted)' } : undefined}
                  ></span>
                  <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>
                    {name}: {active ? 'Connected' : 'Not configured'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
              <span className="badge badge-accent">📸 {status.photos?.total || 0} photos</span>
              <span className="badge badge-blue">🎤 {status.snippets?.keynote || 0} keynote clips</span>
              <span className="badge badge-purple">💬 {status.snippets?.panel || 0} panel clips</span>
            </div>
          </div>
        )}

        <div className="admin-grid">
          {/* Photo Upload */}
          <div className="glass-card admin-card">
            <h3>📸 Upload Event Photos</h3>
            <p className="text-muted" style={{ marginBottom: 'var(--space-lg)', fontSize: '0.9rem' }}>
              Upload all event photos. Faces will be automatically indexed for the Photo Finder feature.
            </p>

            <input
              type="file"
              ref={photoInputRef}
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />

            <div
              className="upload-zone"
              onClick={() => !photoUploading && photoInputRef.current?.click()}
              style={{ padding: 'var(--space-xl)' }}
            >
              {photoUploading ? (
                <Loader text={photoProgress} />
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📁</div>
                  <h3>Drop event photos here</h3>
                  <p>JPG, PNG, WebP • Multiple files supported</p>
                </>
              )}
            </div>

            {photoProgress && !photoUploading && (
              <p style={{ marginTop: 'var(--space-md)', fontSize: '0.85rem', color: photoProgress.includes('✅') ? 'var(--color-accent-primary)' : 'var(--color-accent-rose)' }}>
                {photoProgress}
              </p>
            )}

            <button className="btn btn-secondary btn-sm" onClick={initCollection} style={{ marginTop: 'var(--space-md)' }}>
              🔧 Init Face Collection
            </button>
          </div>

          {/* Video Upload */}
          <div className="glass-card admin-card">
            <h3>🎬 Upload Event Videos</h3>
            <p className="text-muted" style={{ marginBottom: 'var(--space-lg)', fontSize: '0.9rem' }}>
              Upload keynote or panel videos. AI will auto-classify, transcribe, and extract the best snippets.
            </p>

            <input
              type="file"
              ref={videoInputRef}
              accept="video/mp4,video/mov,video/avi,video/webm,video/x-matroska"
              onChange={handleVideoUpload}
              style={{ display: 'none' }}
            />

            <div
              className="upload-zone"
              onClick={() => !videoUploading && videoInputRef.current?.click()}
              style={{ padding: 'var(--space-xl)' }}
            >
              {videoUploading ? (
                <Loader text={videoProgress} />
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🎥</div>
                  <h3>Drop a video file here</h3>
                  <p>MP4, MOV, AVI, WebM • Up to 2GB</p>
                </>
              )}
            </div>

            {videoProgress && !videoUploading && (
              <p style={{ marginTop: 'var(--space-md)', fontSize: '0.85rem', color: videoProgress.includes('✅') ? 'var(--color-accent-primary)' : 'var(--color-accent-rose)' }}>
                {videoProgress}
              </p>
            )}
          </div>
        </div>

        {/* Couple Profiles */}
        <div className="glass-card" style={{ padding: 'var(--space-xl)', marginTop: 'var(--space-xl)' }}>
          <h3 style={{ marginBottom: 'var(--space-sm)' }}>💑 Couple Face Profiles</h3>
          <p className="text-muted" style={{ marginBottom: 'var(--space-lg)', fontSize: '0.9rem' }}>
            Upload a clear selfie for Aditya and Disha. The system will find all their photos from the event using AI face matching.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
            {/* Aditya */}
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ marginBottom: 'var(--space-md)' }}>Aditya</h4>
              <input
                type="file"
                ref={adityaInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleProfileUpload(e, 'Aditya')}
                style={{ display: 'none' }}
              />
              {coupleProfiles.find(p => p.id === 'aditya') ? (
                <div>
                  <img
                    src={getSelfieUrl('aditya')}
                    alt="Aditya"
                    style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-accent-primary)', marginBottom: 'var(--space-sm)' }}
                  />
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                    ✅ {coupleProfiles.find(p => p.id === 'aditya').matchedPhotos} photos matched
                  </p>
                </div>
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--color-bg-secondary)', border: '2px dashed var(--color-border)', margin: '0 auto var(--space-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  👤
                </div>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => adityaInputRef.current?.click()}
                disabled={profileUploading === 'Aditya'}
                style={{ marginTop: 'var(--space-sm)' }}
              >
                {profileUploading === 'Aditya' ? '🔍 Scanning...' : coupleProfiles.find(p => p.id === 'aditya') ? 'Update Photo' : 'Upload Selfie'}
              </button>
            </div>

            {/* Disha */}
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ marginBottom: 'var(--space-md)' }}>Disha</h4>
              <input
                type="file"
                ref={dishaInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleProfileUpload(e, 'Disha')}
                style={{ display: 'none' }}
              />
              {coupleProfiles.find(p => p.id === 'disha') ? (
                <div>
                  <img
                    src={getSelfieUrl('disha')}
                    alt="Disha"
                    style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--color-accent-primary)', marginBottom: 'var(--space-sm)' }}
                  />
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                    ✅ {coupleProfiles.find(p => p.id === 'disha').matchedPhotos} photos matched
                  </p>
                </div>
              ) : (
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--color-bg-secondary)', border: '2px dashed var(--color-border)', margin: '0 auto var(--space-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  👤
                </div>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => dishaInputRef.current?.click()}
                disabled={profileUploading === 'Disha'}
                style={{ marginTop: 'var(--space-sm)' }}
              >
                {profileUploading === 'Disha' ? '🔍 Scanning...' : coupleProfiles.find(p => p.id === 'disha') ? 'Update Photo' : 'Upload Selfie'}
              </button>
            </div>
          </div>
        </div>

        {/* Video Processing Status */}
        {status?.videos?.length > 0 && (
          <div className="glass-card" style={{ padding: 'var(--space-xl)', marginTop: 'var(--space-xl)' }}>
            <h3 style={{ marginBottom: 'var(--space-lg)' }}>📊 Video Processing Status</h3>
            <table className="status-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {status.videos.map((v) => (
                  <tr key={v.id}>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.filename}
                    </td>
                    <td>
                      {v.type ? (
                        <span className={`badge ${v.type === 'keynote' ? 'badge-accent' : 'badge-purple'}`}>
                          {v.type}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`status-dot ${getStatusColor(v.status)}`}></span>
                      {v.status}
                      {v.error_message && (
                        <span style={{ color: 'var(--color-accent-rose)', fontSize: '0.8rem', display: 'block' }}>
                          {v.error_message}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {new Date(v.uploaded_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Activity Log */}
        {logs.length > 0 && (
          <div className="glass-card" style={{ padding: 'var(--space-xl)', marginTop: 'var(--space-xl)' }}>
            <h3 style={{ marginBottom: 'var(--space-md)' }}>📋 Activity Log</h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              lineHeight: '1.8',
              color: 'var(--color-text-secondary)',
            }}>
              {logs.map((log, i) => (
                <div key={i}>
                  <span style={{ color: 'var(--color-text-muted)' }}>[{log.time}]</span> {log.msg}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
