#!/usr/bin/env python3
"""Regenerate toolbar icons with sub-pixel accurate centering.

Strategy:
- Render at 16x oversampling.
- Use geometric center = ((big - 1) / 2, (big - 1) / 2) for even canvases,
  which is the true midpoint between pixel indices 0..big-1.
- Draw ellipses with floating-point bounding boxes so the shape is
  perfectly symmetric around that center.
- Downscale with LANCZOS to the final size.
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public/icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DISC_COLOR = (20, 20, 20, 255)
RING_COLOR = (42, 42, 42, 255)
LABEL_COLOR = (201, 125, 58, 255)
HOLE_COLOR = (20, 20, 20, 255)
TRANSPARENT = (0, 0, 0, 0)

# Radii as fractions of the final icon size.
DISC_R = 0.47
RING_R = 0.35
LABEL_R = 0.22
HOLE_R = 0.03
RING_STROKE = 0.012  # as fraction of final size


def render(size: int) -> None:
    scale = 16
    big = size * scale
    cx = (big - 1) / 2.0
    cy = (big - 1) / 2.0

    img = Image.new("RGBA", (big, big), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    def ellipse(radius_frac: float, fill=None, outline=None, width: float = 0.0):
        r = radius_frac * size * scale
        bbox = (cx - r, cy - r, cx + r, cy + r)
        draw.ellipse(bbox, fill=fill, outline=outline, width=max(1, int(round(width))))

    ellipse(DISC_R, fill=DISC_COLOR)
    ellipse(RING_R, outline=RING_COLOR, width=RING_STROKE * size * scale)
    ellipse(LABEL_R, fill=LABEL_COLOR)
    ellipse(HOLE_R, fill=HOLE_COLOR)

    out = img.resize((size, size), Image.LANCZOS)
    path = OUT_DIR / f"icon{size}.png"
    out.save(path, "PNG")
    print(f"wrote {path}")


def main() -> None:
    for size in (16, 48, 128):
        render(size)


if __name__ == "__main__":
    main()
