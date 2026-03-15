"""
YouTube Downloader — FastAPI Backend
Run: uvicorn server:app --reload --port 8000
"""

import os
import re
import asyncio
import uuid
from pathlib import Path
from typing import Optional

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


jobs: dict = {}

DEFAULT_OUTPUT = str(Path.home() / "Downloads" / "YT_Downloads")



class FetchRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    quality: str          
    output_dir: Optional[str] = DEFAULT_OUTPUT



QUALITY_MAP = {
    "1080": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
    "720":  "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
    "best": "bestvideo+bestaudio/best",
}

def seconds_to_hms(secs: int) -> str:
    m, s = divmod(int(secs), 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"



@app.get("/")
def root():
    return {"status": "YT Downloader API running"}


@app.post("/fetch")
def fetch_info(body: FetchRequest):
    """Return video/playlist metadata without downloading."""
    opts = {"quiet": True, "no_warnings": True, "skip_download": True}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(body.url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=400, detail=str(e))

    is_playlist = info.get("_type") == "playlist"

    if is_playlist:
        entries = info.get("entries") or []
        return {
            "type": "playlist",
            "title": info.get("title", "Unknown Playlist"),
            "channel": info.get("uploader", ""),
            "count": len(entries),
            "thumb": entries[0].get("thumbnail") if entries else None,
        }
    else:
        duration = info.get("duration", 0)
        return {
            "type": "video",
            "title": info.get("title", "Unknown"),
            "channel": info.get("uploader", ""),
            "duration": seconds_to_hms(duration),
            "thumb": info.get("thumbnail"),
        }


@app.post("/download")
def start_download(body: DownloadRequest):
    """Kick off a background download. Returns a job_id immediately."""
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"percent": 0, "speed": "—", "eta": "—", "status": "starting", "error": None}

    import threading
    thread = threading.Thread(target=_run_download, args=(job_id, body), daemon=True)
    thread.start()

    return {"job_id": job_id}


def _run_download(job_id: str, body: DownloadRequest):
    """Runs in a background thread. Updates jobs[job_id] as download progresses."""
    os.makedirs(body.output_dir, exist_ok=True)

    def progress_hook(d):
        if d["status"] == "downloading":
            try:
                downloaded = d.get("downloaded_bytes", 0)
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 1
                pct = int(downloaded / total * 100)
            except Exception:
                pct = 0

            speed_raw = d.get("speed") or 0
            speed_mb  = f"{speed_raw / 1_048_576:.1f} MB/s" if speed_raw else "—"
            eta_raw   = d.get("eta") or 0
            eta_str   = f"{eta_raw}s" if eta_raw else "—"

            jobs[job_id].update({"percent": pct, "speed": speed_mb, "eta": eta_str, "status": "downloading"})

        elif d["status"] == "finished":
            jobs[job_id].update({"percent": 100, "status": "merging", "speed": "—", "eta": "—"})

    fmt = QUALITY_MAP.get(body.quality, QUALITY_MAP["720"])
    opts = {
        "format": fmt,
        "outtmpl": os.path.join(body.output_dir, "%(title)s [%(id)s].%(ext)s"),
        "merge_output_format": "mp4",
        "noplaylist": True,
        "progress_hooks": [progress_hook],
        "postprocessors": [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}],
        "retries": 5,
        "fragment_retries": 5,
    }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([body.url])
        jobs[job_id]["status"] = "done"
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"]  = str(e)


@app.get("/progress/{job_id}")
def get_progress(job_id: str):
    """Poll this endpoint from the frontend to get live download progress."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.get("/progress/{job_id}/stream")
def stream_progress(job_id: str):
    """Server-Sent Events stream — alternative to polling."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    import json, time

    def event_generator():
        while True:
            job = jobs.get(job_id, {})
            yield f"data: {json.dumps(job)}\n\n"
            if job.get("status") in ("done", "error"):
                break
            time.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

#uvicorn server:app --reload --port 8000