import { Tag } from "lucide-react";
import { useState,useEffect,useRef } from "react";

const API = "http://localhost:8000";

const QUALITY_OPTIONS = [
  {
    id:"720", label:"720p", tag:"HD", desc:"High Definition", size:"~300MB/hr",
    icon:(<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 20h8M12 18v2"/></svg>),
  },
  {
     id:"1080", label:"1080p", tag:"FHD", desc:"Full HD", size:"~700MB/hr",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 21h8M12 18v3"/><path d="M7 8l3 4-3 4M13 12h4"/></svg>),
  },
  {
    id: "best", label: "Best", tag: "MAX", desc: "Highest Available", size: "Variable",
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>),
  },
]

const STATUS_LABELS ={
  starting: "Starting...",
  downloading: "Downloading...",
  merging: "Merging streams...",
  done: "Complete",
  error: "Failed",
};

const MOCK_HISTORY=[
  { id: 1, title: "Lofi Hip Hop Radio - Beats to Study", quality: "1080p", size: "1.2 GB", status: "done", thumb: "https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg" },
  { id: 2, title: "The Last of Us — Official Trailer",   quality: "720p",  size: "420 MB", status: "done", thumb: "https://i.ytimg.com/vi/uLtkt8BonwM/mqdefault.jpg" },
];

const Grain=()=>(
   <svg className="pointer-events-none fixed inset-0 w-full h-full opacity-[0.035] mix-blend-overlay" style={{zIndex:9999}}>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    <rect width="100%" height="100%" filter="url(#grain)"/>
  </svg>
);

function Toast({show, error}){
  return(
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#0d0d0d] border ${error ? "border-red-500/40" : "border-[#ff2d2d]/40"} text-white px-5 py-3 rounded-xl shadow-2xl transition-all duration-500 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
      <span className="text-xl">{error ? "❌" : "✅"}</span>
      <div>
        <p className="text-sm font-semibold tracking-wide" style={{fontFamily:"'DM Sans',sans-serif"}}>{error ? "Download Failed" : "Download Complete"}</p>
        <p className="text-xs text-zinc-400" style={{fontFamily:"'DM Mono',monospace"}}>{error ? "Check console for details" : "Saved to Downloads folder"}</p>
      </div>
    </div>
  );
}