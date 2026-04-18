#!/usr/bin/env python3
"""Measure orange-label centroid vs image center for every icon PNG,
and append the result as NDJSON to the debug session log."""
# #region agent log
from __future__ import annotations
import json
import sys
import time
from pathlib import Path
from PIL import Image

LOG_PATH = Path("/Users/shinchanwoo/Desktop/01_dev/01_projects/02_side/vinyl-crackle/.cursor/debug-419d48.log")
SESSION_ID = "419d48"
RUN_ID = sys.argv[1] if len(sys.argv) > 1 else "run-pre-fix"

ROOT = Path("/Users/shinchanwoo/Desktop/01_dev/01_projects/02_side/vinyl-crackle")
TARGETS = [
    ROOT / "public/icons/icon16.png",
    ROOT / "public/icons/icon48.png",
    ROOT / "public/icons/icon128.png",
    ROOT / "dist/icons/icon16.png",
    ROOT / "dist/icons/icon48.png",
    ROOT / "dist/icons/icon128.png",
]


def analyze(path: Path) -> dict:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    sx = sy = n = 0
    rmin, rmax, gmin, gmax, bmin, bmax = 255, 0, 255, 0, 255, 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            # Orange label: R dominant, warm hue, not near-black vinyl body
            if r > 120 and r > g + 20 and g > b + 10 and r - b > 40:
                sx += x
                sy += y
                n += 1
                if r < rmin: rmin = r
                if r > rmax: rmax = r
                if g < gmin: gmin = g
                if g > gmax: gmax = g
                if b < bmin: bmin = b
                if b > bmax: bmax = b
    if n == 0:
        return {"file": str(path), "width": w, "height": h, "orangePixels": 0}
    cx = sx / n
    cy = sy / n
    ideal_x = (w - 1) / 2
    ideal_y = (h - 1) / 2
    return {
        "file": str(path.relative_to(ROOT)),
        "width": w,
        "height": h,
        "orangePixels": n,
        "centroidX": round(cx, 3),
        "centroidY": round(cy, 3),
        "idealX": ideal_x,
        "idealY": ideal_y,
        "deltaX": round(cx - ideal_x, 3),
        "deltaY": round(cy - ideal_y, 3),
        "deltaXpctW": round((cx - ideal_x) / w * 100, 3),
        "deltaYpctH": round((cy - ideal_y) / h * 100, 3),
        "orangeRange": {"r": [rmin, rmax], "g": [gmin, gmax], "b": [bmin, bmax]},
    }


def log(hypothesis_id: str, message: str, data: dict) -> None:
    entry = {
        "sessionId": SESSION_ID,
        "runId": RUN_ID,
        "hypothesisId": hypothesis_id,
        "location": "scripts/debug-icon-centroid.py",
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def main() -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    for target in TARGETS:
        if not target.exists():
            log("H1/H4", "icon file missing", {"file": str(target)})
            continue
        result = analyze(target)
        # H2/H5 = centroid deviation; H4 = dist vs public comparison
        log("H1+H2+H4+H5", "orange-label centroid analysis", result)
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
# #endregion
