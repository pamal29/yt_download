import { useState, useEffect, useRef } from "react";

// ── API base URL — change this if you deploy the backend ──────────────────
const API = "http://localhost:8000";

const QUALITY_OPTIONS = [
  {
    id: "720", label: "720p", tag: "HD", desc: "High Definition", size: "~300MB/hr",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 20h8M12 18v2"/></svg>),
  },
  {
    id: "1080", label: "1080p", tag: "FHD", desc: "Full HD", size: "~700MB/hr",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 21h8M12 18v3"/><path d="M7 8l3 4-3 4M13 12h4"/></svg>),
  },
  {
    id: "best", label: "Best", tag: "MAX", desc: "Highest Available", size: "Variable",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>),
  },
];

const STATUS_LABELS = {
  starting:    "Starting…",
  downloading: "Downloading…",
  merging:     "Merging streams…",
  done:        "Complete ✓",
  error:       "Failed ✗",
};

const MOCK_HISTORY = [
  { id: 1, title: "Lofi Hip Hop Radio - Beats to Study", quality: "1080p", size: "1.2 GB", status: "done", thumb: "https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg" },
  { id: 2, title: "The Last of Us — Official Trailer",   quality: "720p",  size: "420 MB", status: "done", thumb: "https://i.ytimg.com/vi/uLtkt8BonwM/mqdefault.jpg" },
];

// ── Grain overlay ─────────────────────────────────────────────────────────
const Grain = () => (
  <svg className="pointer-events-none fixed inset-0 w-full h-full opacity-[0.035] mix-blend-overlay" style={{zIndex:9999}}>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    <rect width="100%" height="100%" filter="url(#grain)"/>
  </svg>
);

// ── Toast ─────────────────────────────────────────────────────────────────
function Toast({ show, error }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0d0d0d] border ${error ? "border-red-500/40" : "border-[#ff2d2d]/40"} text-white px-5 py-3 rounded-xl shadow-2xl transition-all duration-500 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
      <span className="text-xl">{error ? "❌" : "✅"}</span>
      <div>
        <p className="text-sm font-semibold tracking-wide" style={{fontFamily:"'DM Sans',sans-serif"}}>{error ? "Download Failed" : "Download Complete"}</p>
        <p className="text-xs text-zinc-400" style={{fontFamily:"'DM Mono',monospace"}}>{error ? "Check console for details" : "Saved to Downloads folder"}</p>
      </div>
    </div>
  );
}

// ── Quality Card ──────────────────────────────────────────────────────────
function QualityCard({ opt, selected, onClick }) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-start gap-2 p-4 rounded-2xl border transition-all duration-300 text-left w-full group ${selected ? "border-[#ff2d2d] bg-[#ff2d2d]/10 shadow-[0_0_24px_rgba(255,45,45,0.25)]" : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"}`}>
      {selected && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ff2d2d] shadow-[0_0_8px_#ff2d2d] animate-pulse"/>}
      <div className={`transition-colors duration-300 ${selected ? "text-[#ff2d2d]" : "text-zinc-400 group-hover:text-zinc-200"}`}>{opt.icon}</div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg" style={{fontFamily:"'DM Sans',sans-serif"}}>{opt.label}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tracking-widest ${selected ? "bg-[#ff2d2d]/20 text-[#ff2d2d]" : "bg-white/10 text-zinc-400"}`}>{opt.tag}</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5" style={{fontFamily:"'DM Mono',monospace"}}>{opt.desc}</p>
        <p className="text-xs text-zinc-600 mt-0.5" style={{fontFamily:"'DM Mono',monospace"}}>{opt.size}</p>
      </div>
    </button>
  );
}

// ── Video Preview Card ────────────────────────────────────────────────────
function VideoCard({ info, isPlaylist }) {
  return (
    <div className="flex gap-4 items-start bg-white/[0.03] border border-white/10 rounded-2xl p-4 animate-fadein">
      <div className="relative flex-shrink-0 rounded-xl overflow-hidden w-28 h-16 bg-zinc-800">
        {info.thumb
          ? <img src={info.thumb} alt="" className="w-full h-full object-cover"/>
          : <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-zinc-500 text-xl">▶</div>}
        {info.duration && <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">{info.duration}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-snug truncate" style={{fontFamily:"'DM Sans',sans-serif"}}>{info.title}</p>
        <p className="text-zinc-500 text-xs mt-1" style={{fontFamily:"'DM Mono',monospace"}}>{info.channel}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 rounded-full font-semibold tracking-wide">✓ Verified</span>
          {isPlaylist && <span className="text-[10px] text-blue-400 border border-blue-400/30 bg-blue-400/10 px-2 py-0.5 rounded-full font-semibold tracking-wide">{info.count} videos</span>}
        </div>
      </div>
    </div>
  );
}

// ── Progress Section ──────────────────────────────────────────────────────
function ProgressSection({ percent, speed, eta, status }) {
  const statusLabel = STATUS_LABELS[status] || "Working…";
  const isError = status === "error";
  return (
    <div className="space-y-4 animate-fadein">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_6px_#ff2d2d] ${isError ? "bg-red-500" : "bg-[#ff2d2d]"}`}/>
          <span className="text-zinc-300 text-sm font-medium" style={{fontFamily:"'DM Sans',sans-serif"}}>{statusLabel}</span>
        </div>
        <span className="text-white font-bold text-sm tabular-nums" style={{fontFamily:"'DM Mono',monospace"}}>{percent}%</span>
      </div>
      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${isError ? "bg-red-500" : "bg-gradient-to-r from-[#ff2d2d] to-[#ff7070] shadow-[0_0_12px_#ff2d2d]"}`} style={{width:`${percent}%`}}/>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[["Speed", speed], ["ETA", eta], ["Progress", `${percent}%`]].map(([label, val]) => (
          <div key={label} className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1" style={{fontFamily:"'DM Mono',monospace"}}>{label}</p>
            <p className="text-white text-sm font-bold tabular-nums" style={{fontFamily:"'DM Mono',monospace"}}>{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────
function HistoryPanel({ open, onToggle, items }) {
  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-zinc-400"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span className="text-zinc-300 text-sm font-semibold" style={{fontFamily:"'DM Sans',sans-serif"}}>Recent Downloads</span>
          <span className="text-[10px] bg-white/10 text-zinc-400 px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}><path d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div className={`transition-all duration-500 overflow-hidden ${open ? "max-h-[400px]" : "max-h-0"}`}>
        <div className="divide-y divide-white/5">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">
              <div className="w-12 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                <img src={item.thumb} alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-zinc-200 text-xs truncate" style={{fontFamily:"'DM Sans',sans-serif"}}>{item.title}</p>
                <p className="text-zinc-600 text-[10px] mt-0.5 font-mono">{item.size}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] bg-white/10 text-zinc-400 px-2 py-0.5 rounded-md font-mono">{item.quality}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${item.status === "done" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                  {item.status === "done" ? "Done" : "Failed"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 select-none">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-10 h-10 text-zinc-600"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#ff2d2d]/20 border border-[#ff2d2d]/40 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="#ff2d2d" strokeWidth="2.5" className="w-3 h-3"><path d="M19 9l-7 7-7-7"/></svg>
        </div>
      </div>
      <div className="text-center">
        <p className="text-zinc-400 text-sm font-medium" style={{fontFamily:"'DM Sans',sans-serif"}}>Paste a YouTube URL above</p>
        <p className="text-zinc-600 text-xs mt-1" style={{fontFamily:"'DM Mono',monospace"}}>Supports videos & playlists</p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl]                 = useState("");
  const [quality, setQuality]         = useState("1080");
  const [outputDir, setOutputDir]     = useState("C:\\Users\\you\\Downloads\\YT_Downloads");
  const [videoInfo, setVideoInfo]     = useState(null);
  const [fetching, setFetching]       = useState(false);
  const [fetchError, setFetchError]   = useState("");
  const [jobId, setJobId]             = useState(null);
  const [progress, setProgress]       = useState({ percent: 0, speed: "—", eta: "—", status: "idle" });
  const [done, setDone]               = useState(false);
  const [toast, setToast]             = useState(false);
  const [toastError, setToastError]   = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory]         = useState(MOCK_HISTORY);
  const [isPlaylist, setIsPlaylist]   = useState(false);
  const pollRef                       = useRef(null);

  // ── Fetch video info from backend ──────────────────────────────────────
  const handleFetch = async () => {
    if (!url.trim()) return;
    setFetching(true);
    setFetchError("");
    setVideoInfo(null);
    setDone(false);
    setJobId(null);
    setProgress({ percent: 0, speed: "—", eta: "—", status: "idle" });

    try {
      const res  = await fetch(`${API}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to fetch video info");
      }
      const data = await res.json();
      setIsPlaylist(data.type === "playlist");
      setVideoInfo(data);
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setFetching(false);
    }
  };

  // ── Start download on backend, then poll for progress ─────────────────
  const handleDownload = async () => {
    if (!videoInfo) return;
    setDone(false);

    try {
      // 1. POST /download → get job_id back immediately
      const res = await fetch(`${API}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, quality, output_dir: outputDir }),
      });
      if (!res.ok) throw new Error("Failed to start download");
      const { job_id } = await res.json();
      setJobId(job_id);
      setProgress({ percent: 0, speed: "—", eta: "—", status: "starting" });

      // 2. Poll GET /progress/:job_id every 600ms
      pollRef.current = setInterval(async () => {
        try {
          const pRes  = await fetch(`${API}/progress/${job_id}`);
          const pData = await pRes.json();
          setProgress(pData);

          if (pData.status === "done") {
            clearInterval(pollRef.current);
            setDone(true);
            setToast(true);
            setToastError(false);
            // Add to history
            setHistory(prev => [{
              id: Date.now(),
              title: videoInfo.title,
              quality: quality === "best" ? "Best" : `${quality}p`,
              size: "—",
              status: "done",
              thumb: videoInfo.thumb,
            }, ...prev.slice(0, 9)]);
            setTimeout(() => setToast(false), 3500);
          }

          if (pData.status === "error") {
            clearInterval(pollRef.current);
            setToast(true);
            setToastError(true);
            setHistory(prev => [{
              id: Date.now(),
              title: videoInfo.title,
              quality: quality === "best" ? "Best" : `${quality}p`,
              size: "—",
              status: "failed",
              thumb: videoInfo.thumb,
            }, ...prev.slice(0, 9)]);
            setTimeout(() => setToast(false), 3500);
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 600);

    } catch (err) {
      console.error(err);
      setToastError(true);
      setToast(true);
      setTimeout(() => setToast(false), 3500);
    }
  };

  const handlePaste = async () => {
    try { setUrl(await navigator.clipboard.readText()); } catch {}
  };

  const reset = () => {
    clearInterval(pollRef.current);
    setDone(false); setVideoInfo(null); setUrl("");
    setProgress({ percent: 0, speed: "—", eta: "—", status: "idle" });
    setJobId(null); setFetchError("");
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const isDownloading = jobId && !done && progress.status !== "error";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes fadein { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .animate-fadein { animation: fadein 0.45s ease both; }
        .animate-spin-slow { animation: spin 1s linear infinite; }
        body { background: #080808; }
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
      `}</style>

      <Grain />
      <Toast show={toast} error={toastError} />

      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-start py-16 px-4">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#ff2d2d] opacity-[0.04] blur-[120px] rounded-full pointer-events-none"/>

        <div className="w-full max-w-lg space-y-5 relative z-10">

          {/* Header */}
          <div className="text-center mb-8 animate-fadein">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#ff2d2d] flex items-center justify-center shadow-[0_0_20px_rgba(255,45,45,0.5)]">
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
              </div>
              <h1 className="text-white text-2xl font-bold tracking-tight" style={{fontFamily:"'DM Sans',sans-serif"}}>YT Downloader</h1>
            </div>
            <p className="text-zinc-500 text-sm" style={{fontFamily:"'DM Mono',monospace"}}>720p · 1080p · best quality · playlist support</p>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center justify-between px-1 animate-fadein" style={{animationDelay:"0.05s"}}>
            <span className="text-zinc-400 text-xs font-medium" style={{fontFamily:"'DM Sans',sans-serif"}}>Mode</span>
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-xl p-1">
              {["Single Video", "Playlist"].map(m => (
                <button key={m} onClick={() => setIsPlaylist(m === "Playlist")}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-200 ${isPlaylist === (m === "Playlist") ? "bg-[#ff2d2d] text-white shadow-[0_0_12px_rgba(255,45,45,0.3)]" : "text-zinc-500 hover:text-zinc-300"}`}
                  style={{fontFamily:"'DM Sans',sans-serif"}}>{m}</button>
              ))}
            </div>
          </div>

          {/* URL Input */}
          <div className="animate-fadein" style={{animationDelay:"0.1s"}}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && handleFetch()}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-white/[0.04] border border-white/10 text-white placeholder-zinc-600 rounded-xl px-4 py-3.5 pr-10 text-sm focus:outline-none focus:border-[#ff2d2d]/50 focus:bg-white/[0.06] transition-all"
                  style={{fontFamily:"'DM Mono',monospace"}}/>
                <button onClick={handlePaste} title="Paste from clipboard" className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </button>
              </div>
              <button onClick={handleFetch} disabled={fetching || !url.trim()}
                className="bg-[#ff2d2d] hover:bg-[#e02020] disabled:bg-zinc-700 disabled:cursor-not-allowed text-white px-5 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-[0_0_20px_rgba(255,45,45,0.3)] hover:shadow-[0_0_28px_rgba(255,45,45,0.45)] active:scale-95"
                style={{fontFamily:"'DM Sans',sans-serif"}}>
                {fetching
                  ? <svg className="w-4 h-4 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                  : "Fetch"}
              </button>
            </div>
            {fetchError && <p className="text-red-400 text-xs mt-2 px-1 font-mono">{fetchError}</p>}
          </div>

          {/* Fetching skeleton */}
          {fetching && (
            <div className="flex gap-4 items-start bg-white/[0.03] border border-white/10 rounded-2xl p-4 animate-fadein">
              <div className="w-28 h-16 rounded-xl bg-white/[0.07] animate-pulse flex-shrink-0"/>
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 bg-white/[0.07] rounded-full animate-pulse w-3/4"/>
                <div className="h-2.5 bg-white/[0.05] rounded-full animate-pulse w-1/2"/>
                <div className="h-5 bg-white/[0.04] rounded-full animate-pulse w-1/3 mt-3"/>
              </div>
            </div>
          )}

          {/* Video card */}
          {videoInfo && !fetching && <VideoCard info={videoInfo} isPlaylist={isPlaylist}/>}

          {/* Empty state */}
          {!videoInfo && !fetching && !jobId && <EmptyState />}

          {/* Quality selector */}
          {videoInfo && !fetching && !isDownloading && !done && (
            <div className="animate-fadein space-y-3">
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest px-1" style={{fontFamily:"'DM Mono',monospace"}}>Quality</p>
              <div className="grid grid-cols-3 gap-3">
                {QUALITY_OPTIONS.map(opt => <QualityCard key={opt.id} opt={opt} selected={quality === opt.id} onClick={() => setQuality(opt.id)}/>)}
              </div>
            </div>
          )}

          {/* Output path */}
          {videoInfo && !fetching && !isDownloading && !done && (
            <div className="animate-fadein space-y-2">
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest px-1" style={{fontFamily:"'DM Mono',monospace"}}>Save to</p>
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
                <input value={outputDir} onChange={e => setOutputDir(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 text-zinc-300 rounded-xl pl-10 pr-4 py-3 text-xs focus:outline-none focus:border-white/20 transition-all"
                  style={{fontFamily:"'DM Mono',monospace"}}/>
              </div>
            </div>
          )}

          {/* Download button */}
          {videoInfo && !fetching && !isDownloading && !done && (
            <button onClick={handleDownload}
              className="w-full bg-[#ff2d2d] hover:bg-[#e02020] text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-[0_0_30px_rgba(255,45,45,0.25)] hover:shadow-[0_0_40px_rgba(255,45,45,0.4)] active:scale-[0.98] animate-fadein"
              style={{fontFamily:"'DM Sans',sans-serif"}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Start Download — {quality === "best" ? "Best Quality" : `${quality}p`}
            </button>
          )}

          {/* Progress */}
          {isDownloading && (
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 animate-fadein">
              <ProgressSection percent={progress.percent} speed={progress.speed} eta={progress.eta} status={progress.status}/>
            </div>
          )}

          {/* Error state */}
          {progress.status === "error" && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 animate-fadein">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" className="w-5 h-5"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-red-400 font-semibold text-sm" style={{fontFamily:"'DM Sans',sans-serif"}}>Download failed</p>
                <p className="text-zinc-500 text-xs mt-0.5 font-mono truncate">{progress.error || "Unknown error"}</p>
              </div>
              <button onClick={reset} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          {/* Done state */}
          {done && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 flex items-center gap-4 animate-fadein">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" className="w-5 h-5"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div>
                <p className="text-emerald-400 font-semibold text-sm" style={{fontFamily:"'DM Sans',sans-serif"}}>Download complete</p>
                <p className="text-zinc-500 text-xs mt-0.5" style={{fontFamily:"'DM Mono',monospace"}}>{outputDir}</p>
              </div>
              <button onClick={reset} className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          )}

          {/* History */}
          <div className="animate-fadein" style={{animationDelay:"0.2s"}}>
            <HistoryPanel open={historyOpen} onToggle={() => setHistoryOpen(o => !o)} items={history}/>
          </div>

          <p className="text-center text-zinc-700 text-xs pb-4" style={{fontFamily:"'DM Mono',monospace"}}>powered by yt-dlp + ffmpeg · for personal use only</p>
        </div>
      </div>
    </>
  );
}