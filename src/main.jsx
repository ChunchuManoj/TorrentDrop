import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const browserTrackers = [
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.webtorrent.dev",
];

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
};

const addBrowserTrackers = (magnet) => browserTrackers.reduce((value, tracker) => (
  value.includes(encodeURIComponent(tracker)) ? value : `${value}&tr=${encodeURIComponent(tracker)}`
), magnet);

function Icon({ children, size = 19 }) {
  return <span className="material-symbols-rounded" style={{ fontSize: size }}>{children}</span>;
}

function App() {
  const clientRef = useRef(null);
  const torrentRef = useRef(null);
  const [magnet, setMagnet] = useState("");
  const [torrent, setTorrent] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(0);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [downloaded, setDownloaded] = useState(0);

  useEffect(() => () => {
    torrentRef.current?.destroy();
    clientRef.current?.destroy();
  }, []);

  const clearDownload = () => {
    torrentRef.current?.destroy();
    torrentRef.current = null;
    setTorrent(null);
    setFiles([]);
    setProgress(0);
    setSpeed(0);
    setDownloaded(0);
    setStatus("idle");
    setError("");
  };

  const startDownload = async () => {
    if (!magnet.trim().startsWith("magnet:?")) {
      setError("Paste a valid magnet link.");
      return;
    }
    clearDownload();
    setStatus("connecting");
    try {
      const { default: WebTorrent } = await import("webtorrent/dist/webtorrent.min.js");
      clientRef.current ||= new WebTorrent();
      const torrent = clientRef.current.add(addBrowserTrackers(magnet.trim()));
      torrentRef.current = torrent;
      torrent.on("metadata", () => {
        setTorrent(torrent);
        setFiles([...torrent.files]);
        setSelectedFile(0);
        setStatus("ready");
      });
      torrent.on("download", () => {
        setProgress(torrent.progress * 100);
        setSpeed(torrent.downloadSpeed);
        setDownloaded(torrent.downloaded);
      });
      torrent.on("done", () => {
        setProgress(100);
        setSpeed(0);
        setDownloaded(torrent.downloaded);
        setStatus("complete");
      });
      torrent.on("error", (torrentError) => {
        setError(torrentError.message || "The torrent could not be started in this browser.");
        setStatus("error");
      });
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "WebTorrent could not start.");
      setStatus("error");
    }
  };

  const beginSelectedDownload = () => {
    if (!torrent || !files[selectedFile]) return;
    setStatus("downloading");
    files.forEach((file, index) => file.select(index === selectedFile));
  };

  const pauseDownload = () => {
    if (!torrent) return;
    torrent.pause();
    setStatus("paused");
  };

  const resumeDownload = () => {
    if (!torrent) return;
    setStatus("resuming");
    torrent.resume();
    window.setTimeout(() => setStatus("downloading"), 1500);
  };

  const saveFile = async () => {
    const file = files[selectedFile];
    if (!file) return;
    try {
      if ("showSaveFilePicker" in window) {
        const handle = await window.showSaveFilePicker({ suggestedName: file.name });
        const writable = await handle.createWritable();
        const blob = await file.blob();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = await new Promise((resolve, reject) => file.getBlobURL((fileError, blobUrl) => fileError ? reject(fileError) : resolve(blobUrl)));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    } catch (saveError) {
      if (saveError.name !== "AbortError") setError(`Could not save the file: ${saveError.message}`);
    }
  };

  const isActive = ["connecting", "ready", "downloading", "resuming"].includes(status);

  return (
    <main className="app-shell">
      <nav className="topbar">
        <div className="brand"><span className="brand-mark"><Icon>bolt</Icon></span> Torrent<span className="brand-accent">Drop</span></div>
        <span className="privacy"><Icon size={15}>language</Icon> Browser P2P</span>
      </nav>

      <section className="hero">
        <div className="eyebrow"><Icon size={15}>hub</Icon> TORRENT DOWNLOADER</div>
        <h1>Drop a link.<br /><span>Get your file.</span></h1>
        <p className="subtitle">Download authorized files directly from peers to your device. No server storage.</p>
        <div className="download-card">
          <label htmlFor="magnet-input">MAGNET LINK</label>
          <div className="input-row">
            <div className="input-wrap"><Icon size={18}>link</Icon><input id="magnet-input" value={magnet} onChange={(event) => { setMagnet(event.target.value); setError(""); }} placeholder="magnet:?xt=urn:btih:..." disabled={isActive} /></div>
            <button className="primary-button" onClick={startDownload} disabled={isActive || !magnet.trim()}><Icon size={18}>search</Icon> Resolve torrent</button>
          </div>
          {error && <div className="error-message"><Icon size={16}>error</Icon>{error}</div>}
          <p className="legal-note"><Icon size={14}>shield</Icon> Only download content you own or have permission to access.</p>
        </div>
      </section>

      {status !== "idle" && <section className="progress-card">
        <div className="progress-header">
          <div className="file-heading"><div className="file-icon"><Icon>{status === "complete" ? "check_circle" : "movie"}</Icon></div><div><h2>{torrent?.name || "Connecting to peers"}</h2><p>{status === "connecting" ? "Finding metadata and peers..." : `${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytes(torrent?.length)}`}</p></div></div>
          <button className="close-button" onClick={clearDownload} aria-label="Cancel and clear"><Icon>close</Icon></button>
        </div>

        {(status === "ready" || status === "connecting") && files.length > 0 && <div className="file-list">
          <label>SELECT FILE</label>
          {files.map((file, index) => <label className="file-option" key={file.path}><input type="radio" checked={selectedFile === index} onChange={() => setSelectedFile(index)} /><span>{file.name}</span><small>{formatBytes(file.length)}</small></label>)}
          <button className="save-button" onClick={beginSelectedDownload}><Icon>download</Icon> Start download</button>
        </div>}

        {["downloading", "paused", "resuming", "complete"].includes(status) && <>
          <div className="selected-name">{files[selectedFile]?.name}</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <div className="progress-meta"><span>{status === "complete" ? "Download complete" : status === "paused" ? "Paused" : status === "resuming" ? "Resuming… please wait" : `${progress.toFixed(1)}% downloaded`}</span><span>{status === "downloading" ? `${formatBytes(speed)}/s · ${formatBytes(downloaded)}` : ""}</span></div>
          <div className="action-row">
            {status === "complete" ? <button className="save-button" onClick={saveFile}><Icon>save</Icon> Save to device</button> : status === "paused" ? <button className="secondary-button" onClick={resumeDownload}><Icon>play_arrow</Icon> Resume</button> : status === "resuming" ? <button className="secondary-button" disabled><Icon>sync</Icon> Resuming…</button> : <button className="secondary-button" onClick={pauseDownload}><Icon>pause</Icon> Pause</button>}
            <button className="cancel-button" onClick={clearDownload}><Icon>cancel</Icon> Cancel</button>
          </div>
        </>}
      </section>}
      <footer>PEER-TO-PEER <span>·</span> YOUR DEVICE <span>·</span> YOUR FILE</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
