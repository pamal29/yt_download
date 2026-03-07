#!/usr/bin/env python3
"""
YouTube Video Downloader
Supports 720p and 1080p quality downloads using yt-dlp
Usage: python yt_downloader.py
"""

import os
import sys
import re
import subprocess
from pathlib import Path


# ── Dependency check ──────────────────────────────────────────────────────────

def check_and_install_deps():
    """Install yt-dlp if not present."""
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        print("📦 Installing yt-dlp...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "yt-dlp", "--quiet"])
        print("✅ yt-dlp installed.\n")

check_and_install_deps()
import yt_dlp  # noqa: E402  (import after install)


# ── Helpers ───────────────────────────────────────────────────────────────────

def sanitize_filename(name: str) -> str:
    """Remove characters that are unsafe in filenames."""
    return re.sub(r'[\\/*?:"<>|]', "_", name)


def build_ydl_opts(quality: str, output_dir: str) -> dict:
    """
    Return yt-dlp options for the requested quality.

    Strategy
    --------
    - 1080p : best video up to 1080p  + best audio, merged to MP4
    - 720p  : best video up to  720p  + best audio, merged to MP4
    - best  : highest available quality
    """
    output_template = os.path.join(output_dir, "%(title)s [%(id)s].%(ext)s")

    quality_map = {
        "1080": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
        "720":  "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best",
        "best": "bestvideo+bestaudio/best",
    }

    return {
        "format": quality_map.get(quality, quality_map["720"]),
        "outtmpl": output_template,
        "merge_output_format": "mp4",
        "noplaylist": True,          # single video by default
        "progress_hooks": [progress_hook],
        "postprocessors": [
            {
                "key": "FFmpegVideoConvertor",
                "preferedformat": "mp4",
            }
        ],
        # Retry / network options
        "retries": 5,
        "fragment_retries": 5,
        "ignoreerrors": False,
        # Metadata
        "writethumbnail": False,
        "writeinfojson": False,
        # Verbosity
        "quiet": False,
        "no_warnings": False,
    }


# ── Progress display ──────────────────────────────────────────────────────────

_last_percent = -1

def progress_hook(d: dict):
    global _last_percent

    if d["status"] == "downloading":
        percent_str = d.get("_percent_str", "?%").strip()
        speed_str   = d.get("_speed_str", "?").strip()
        eta_str     = d.get("_eta_str", "?").strip()

        # Only print on whole-percent changes to reduce noise
        try:
            percent = int(float(d.get("downloaded_bytes", 0) /
                                 max(d.get("total_bytes") or d.get("total_bytes_estimate") or 1, 1) * 100))
        except Exception:
            percent = -1

        if percent != _last_percent:
            _last_percent = percent
            print(f"\r  ⬇  {percent_str:>6}  |  speed: {speed_str:>10}  |  ETA: {eta_str}", end="", flush=True)

    elif d["status"] == "finished":
        print(f"\n  ✅ Download complete → {os.path.basename(d['filename'])}")

    elif d["status"] == "error":
        print("\n  ❌ An error occurred during download.")


# ── Core download function ────────────────────────────────────────────────────

def get_video_info(url: str) -> dict:
    """Fetch metadata without downloading."""
    opts = {"quiet": True, "no_warnings": True, "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def download_video(url: str, quality: str, output_dir: str) -> bool:
    """Download a single video. Returns True on success."""
    global _last_percent
    _last_percent = -1

    os.makedirs(output_dir, exist_ok=True)
    opts = build_ydl_opts(quality, output_dir)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
        return True
    except yt_dlp.utils.DownloadError as exc:
        print(f"\n  ❌ Download failed: {exc}")
        return False


def download_playlist(url: str, quality: str, output_dir: str):
    """Download all videos in a playlist."""
    global _last_percent
    _last_percent = -1

    os.makedirs(output_dir, exist_ok=True)
    opts = build_ydl_opts(quality, output_dir)
    opts["noplaylist"] = False   # allow playlist

    print(f"\n📋 Downloading playlist → {output_dir}\n")
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])


# ── CLI ───────────────────────────────────────────────────────────────────────

QUALITY_CHOICES = {"1": "720", "2": "1080", "3": "best"}

BANNER = """
╔══════════════════════════════════════════════╗
║        🎬  YouTube Video Downloader         ║
║          720p  |  1080p  |  Best            ║
╚══════════════════════════════════════════════╝
"""


def prompt_quality() -> str:
    print("Select quality:")
    print("  [1] 720p  (HD)")
    print("  [2] 1080p (Full HD)")
    print("  [3] Best available")
    choice = input("Choice [1/2/3] (default 1): ").strip() or "1"
    return QUALITY_CHOICES.get(choice, "720")


def prompt_output_dir() -> str:
    default = str(Path.home() / "Downloads" / "YT_Downloads")
    raw = input(f"Output directory [{default}]: ").strip()
    return raw if raw else default


def main():
    print(BANNER)

    # ── URL ──
    url = input("Enter YouTube URL (video or playlist): ").strip()
    if not url:
        print("No URL provided. Exiting.")
        sys.exit(1)

    # ── Fetch info ──
    print("\n🔍 Fetching video info...")
    try:
        info = get_video_info(url)
    except Exception as exc:
        print(f"❌ Could not fetch info: {exc}")
        sys.exit(1)

    is_playlist = info.get("_type") == "playlist"

    if is_playlist:
        count = len(info.get("entries") or [])
        print(f"📋 Playlist detected: '{info.get('title', 'Unknown')}' — {count} video(s)")
        do_playlist = input("Download entire playlist? [y/N]: ").strip().lower()
    else:
        title    = info.get("title", "Unknown")
        duration = info.get("duration", 0)
        mins, secs = divmod(int(duration), 60)
        print(f"🎬 Title   : {title}")
        print(f"⏱  Duration: {mins}m {secs:02d}s")

    # ── Quality & output ──
    quality    = prompt_quality()
    output_dir = prompt_output_dir()

    print(f"\n⚙  Quality : {quality}p" if quality != "best" else "\n⚙  Quality : best available")
    print(f"📁 Saving to: {output_dir}\n")

    # ── Download ──
    if is_playlist and do_playlist == "y":
        download_playlist(url, quality, output_dir)
    else:
        print(f"⬇  Downloading: {info.get('title', url)}\n")
        success = download_video(url, quality, output_dir)
        if not success:
            sys.exit(1)

    print(f"\n🎉 All done! Files saved to: {output_dir}")


if __name__ == "__main__":
    main()