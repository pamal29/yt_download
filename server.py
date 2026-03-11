import os
import re
import asyncio
import uuid
from pathlib import path
from typing import Optional

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI()

#allow react to dev server
app.add_middleware(
  CORSMiddleware,
  allow_origins=["https://localhost:5173", "http://localhost:3000"],
  allow_methods=["*"],
  allow_headers=["*"],
)

#in-memory job store
jobs: dict={}

DEFAULT_OUTPUT = str(path.home()/"Downloads"/"YT_Downloads")


#request models
class FetchRequest(BaseModel):
  url:str

class DownloadRequest(BaseModel):
  url:str
  quality:str
  output_dir: Optional[str] = DEFAULT_OUTPUT

  #helpers

QUALITY_MAP = {
  "1080": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
  "720":  "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
  "best": "bestvideo+bestaudio/best",
}

def seconds_to_hws(secs:int) -> str:
  m, s = divmod(int(secs),60)
  h, m = divmod(m, 60)
  return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

#ROUTES

@app.get("/")
def root():
  return{"status": "YT download API running"}

@app.post("/fetch")
def fetch_info(body: FetchRequest):
  """Return video/playlist metadata without downloading"""
  opts ={"quiet":True, "no_warnings": True, "skip_download":True}

  try:
    with yt.yt_dlp.YoutubeDL(opts) as ydl:
      info = ydl.exract_info(body.url, download= False)
  except yt_dlp.utils.DownloadError as e:
    raise HTTPException(status_code=400, detail= str(e))

  is_playlist = info.get("_type") == "playlist"

  if is_playlist:
    entries = info.get("entries") or []
    return{
      "type": "playlist",
      "title": info.get("title", "unknown playlist"),
      "channel": info.get("uploader", ""),
      "count": len(entries),
      "thumb": entries[0].get("thumbnail") if entries else None,
    }
  else:
    duration = info.get("duration",0)
    return{
      "type": "video",
      "title": info.get("title", "unknown"),
      "channel": info.get("uploader", ""),
      "duration":seconds_to_hms(duration),
      "thumb": info.get("thumbnail")
    }

@app.post("/download")
def start_download(body: DownloadRequest):
  """Kick off a background download. Returns a job_id immediately."""
  job_id =str(uuid.uuid4())
  jobs[job_id] = {"precent": 0, "speed": "-", "eta": "-", "status": "starting", "error": None}

  # run download bg so http returns quickly
  import threading
  thread = threading.Thread(target=_run_download, args=(job_id, body), daemon=True)
  thread.start()

  return {"job_id": job_id}

def _run_download(job_id:str, body:DownloadRequest):
  """Runs in a bg thread, updates jobs[job_id] until complete or error"""
  os.makedirs(body.output_dir, exist_ok=True)

  def progress_hook(d):
    if d["status"] == "downloading":
      try:
        downloaded = d.get("downloaded_bytes",0)
        total = d.get("total_bytes") or d.get("total_bytes_estimate") or 1
        pct = int(downloaded/total * 100) 
      except Exception:
        pct = 0
    speed = d.get("speed") or 0
    speed_mb = f"{speed / 1_048_576: .1f} MB/s" if speed else "—"
    eta_raw = d.get("eta") or 0
    eta_str = f"{eta_raw}s" if eta_raw else "—" 

    jobs[job_id].update({"precent": pct, "speed": speed_mb, "eta": eta_str, "status": "downloading"})
    


