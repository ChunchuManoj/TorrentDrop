import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const formatSpeed = (bytes) => `${formatBytes(bytes)}/s`;

function Icon({ name, size = 20 }) {
  const paths = {
    arrow: <><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.07.07l1.5-1.5a5 5 0 0 0-7.07-7.07l-.86.86" /><path d="M14 11a5 5 0 0 0-7.07-.07l-1.5 1.5a5 5 0 0 0 7.07 7.07l.86-.86" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    x: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    film: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18M17 3v18M3 7h4M17 7h4M3 17h4M17 17h4M3 12h18" /></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7z" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function App() {
  const pollRef = useRef(null);
  const [magnet, setMagnet] = useState("");
  const [torrent, setTorrent] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [file, setFile] = useState(null);

  useEffect(() => () => window.clearInterval(pollRef.current), []);

  const reset = () => {
    window.clearInterval(pollRef.current);
    setTorrent(null);
    setFile(null);
    setProgress(0);
    setDownloaded(0);
    setSpeed(0);
    setError("");
    setStatus("idle");
  };

  const startDownload = async () => {
    const value = magnet.trim();
    if (!value.startsWith("magnet:?")) {
      setError("Paste a valid magnet link to continue.");
      return;
    }
    reset();
    setStatus("connecting");
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ magnet: value }),
      });
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || "The download could not be started.");
      setTorrent(job);
      pollRef.current = window.setInterval(async () => {
        const updateResponse = await fetch(`/api/downloads/${job.id}`);
        const update = await updateResponse.json();
        if (!updateResponse.ok) return;
        setTorrent(update);
        setStatus(update.status);
        setProgress(update.progress);
        setDownloaded(update.downloaded);
        setSpeed(update.speed);
        setFile(update.file);
        if (update.status === "error") {
          setError(update.error);
          window.clearInterval(pollRef.current);
        }
        if (update.status === "complete") window.clearInterval(pollRef.current);
      }, 1000);
    } catch (torrentError) {
      setError(torrentError instanceof Error ? torrentError.message : "The download could not be started.");
      setStatus("error");
    }
  };

  const saveFile = () => {
    if (file?.url) window.location.href = file.url;
  };

  const isActive = status === "connecting" || status === "downloading";
  const title = torrent?.name || "Ready for your magnet link";
  const displayProgress = Math.min(100, Math.max(0, progress));

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand"><span className="brand-mark"><Icon name="bolt" size={16} /></span><span>Torrent<span className="brand-accent">Drop</span></span></div>
        <span className="privacy"><Icon name="shield" size={15} /> Powered by local Node</span>
      </nav>

      <section className="hero">
        <div className="eyebrow"><Icon name="film" size={15} /> SIMPLE MOVIE DOWNLOADS</div>
        <h1>Drop a link.<br /><span>Get your movie.</span></h1>
        <p className="subtitle">Paste a magnet link below and let the local Node downloader handle the transfer.</p>

        <div className="download-card">
          <label htmlFor="magnet-input">MAGNET LINK</label>
          <div className="input-row">
            <div className="input-wrap"><Icon name="link" size={18} /><input id="magnet-input" value={magnet} onChange={(event) => { setMagnet(event.target.value); setError(""); }} onKeyDown={(event) => event.key === "Enter" && startDownload()} placeholder="magnet:?xt=urn:btih:..." disabled={isActive} /></div>
            <button className="primary-button" onClick={startDownload} disabled={isActive || !magnet.trim()}><Icon name="arrow" size={18} /> {isActive ? "Connecting..." : "Download"}</button>
          </div>
          {error && <div className="error-message"><Icon name="info" size={16} /> {error}</div>}
          <p className="legal-note"><Icon name="shield" size={14} /> Downloads run locally on your computer. Only use content you have permission to access.</p>
        </div>
      </section>

      <section className={`progress-card ${status !== "idle" ? "visible" : ""}`}>
        <div className="progress-header">
          <div className="file-heading"><div className="file-icon"><Icon name={status === "complete" ? "check" : "film"} size={20} /></div><div><h2>{title}</h2><p>{status === "connecting" ? "Finding peers..." : status === "complete" ? "Download complete" : torrent ? `${formatBytes(torrent.length || 0)} · ${file?.name || "Preparing files"}` : "Your download will appear here"}</p></div></div>
          {status === "complete" && <button className="close-button" onClick={reset} aria-label="Clear download"><Icon name="x" size={18} /></button>}
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${displayProgress}%` }} /></div>
        <div className="progress-meta"><span>{status === "connecting" ? "Connecting to peers" : status === "complete" ? "Ready to save" : `${displayProgress.toFixed(1)}% downloaded`}</span><span>{isActive ? `${formatSpeed(speed)} · ${formatBytes(downloaded)}` : status === "complete" ? "100%" : ""}</span></div>
        {status === "complete" && <button className="save-button" onClick={saveFile}><Icon name="arrow" size={18} /> Save movie to device</button>}
      </section>

      <section className="feature-row">
        <div><span className="feature-icon"><Icon name="bolt" size={18} /></span><div><strong>Peer-to-peer</strong><p>Fast, direct transfers</p></div></div>
        <div><span className="feature-icon"><Icon name="shield" size={18} /></span><div><strong>Private by design</strong><p>No uploads or accounts</p></div></div>
        <div><span className="feature-icon"><Icon name="check" size={18} /></span><div><strong>One click</strong><p>Simple file saving</p></div></div>
      </section>

      <footer>TORRENTDROP <span>·</span> USE RESPONSIBLY</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
