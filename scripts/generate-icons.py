#!/usr/bin/env python3
"""Regenerate toolbar icons with sub-pixel accurate centering, plus mode
indicator variants composited onto the base vinyl icon.

Strategy:
- Oversample 16x, use geometric center (big-1)/2 with floating-point bbox,
  downscale with LANCZOS. This guarantees pixel-symmetric output.
- For each mode (off / overlay / ambient) composite a small indicator at
  the bottom-right corner of the vinyl, drawn with the same oversampling
  pipeline so the indicator itself is also pixel-symmetric.
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public/icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SCALE = 16  # oversampling factor
TRANSPARENT = (0, 0, 0, 0)

DISC_COLOR = (20, 20, 20, 255)
RING_COLOR = (42, 42, 42, 255)
LABEL_COLOR = (201, 125, 58, 255)
HOLE_COLOR = (20, 20, 20, 255)

# Base vinyl (fractions of final icon size).
DISC_R = 0.47
RING_R = 0.35
LABEL_R = 0.22
HOLE_R = 0.03
RING_STROKE = 0.012

# Mode indicator geometry (fractions of final icon size).
IND_BG_R = 0.26       # dark backdrop radius
IND_FG_R = 0.18       # indicator shape radius
IND_CENTER = 0.72     # center coordinate (x and y) on the icon — bottom right
IND_OUTLINE = 0.045   # stroke width for hollow ring (off)

IND_BG_COLOR = (20, 20, 20, 255)
IND_OFF_COLOR = (156, 163, 175, 255)     # gray — disabled
IND_ACTIVE_COLOR = (201, 125, 58, 255)   # brand orange

MODES = ("off", "overlay", "ambient")


def draw_centered_ellipse(draw: ImageDraw.ImageDraw, cx: float, cy: float,
                          r: float, *, fill=None, outline=None, width: int = 0) -> None:
    draw.ellipse((cx - r, cy - r, cx + r, cy + r),
                 fill=fill, outline=outline, width=max(1, width) if outline else 0)


def draw_centered_pieslice(draw: ImageDraw.ImageDraw, cx: float, cy: float,
                           r: float, start: float, end: float, *, fill) -> None:
    draw.pieslice((cx - r, cy - r, cx + r, cy + r), start, end, fill=fill)


def render(size: int, mode: str) -> Path:
    big = size * SCALE
    cx = (big - 1) / 2.0
    cy = (big - 1) / 2.0

    img = Image.new("RGBA", (big, big), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    # Base vinyl.
    draw_centered_ellipse(draw, cx, cy, DISC_R * size * SCALE, fill=DISC_COLOR)
    draw_centered_ellipse(draw, cx, cy, RING_R * size * SCALE,
                          outline=RING_COLOR, width=int(round(RING_STROKE * size * SCALE)))
    draw_centered_ellipse(draw, cx, cy, LABEL_R * size * SCALE, fill=LABEL_COLOR)
    draw_centered_ellipse(draw, cx, cy, HOLE_R * size * SCALE, fill=HOLE_COLOR)

    # Mode indicator — placed off-center at bottom-right.
    ix = IND_CENTER * size * SCALE
    iy = IND_CENTER * size * SCALE
    bg_r = IND_BG_R * size * SCALE
    fg_r = IND_FG_R * size * SCALE
    stroke = max(1, int(round(IND_OUTLINE * size * SCALE)))

    # Dark backdrop for contrast regardless of site background.
    draw_centered_ellipse(draw, ix, iy, bg_r, fill=IND_BG_COLOR)

    if mode == "off":
        # Hollow ring.
        draw_centered_ellipse(draw, ix, iy, fg_r,
                              outline=IND_OFF_COLOR, width=stroke)
    elif mode == "overlay":
        # Left half filled, right half hollow — symbolizes media-dependent overlay.
        draw_centered_pieslice(draw, ix, iy, fg_r, 90, 270, fill=IND_ACTIVE_COLOR)
        draw_centered_ellipse(draw, ix, iy, fg_r,
                              outline=IND_ACTIVE_COLOR, width=stroke)
    elif mode == "ambient":
        # Fully filled.
        draw_centered_ellipse(draw, ix, iy, fg_r, fill=IND_ACTIVE_COLOR)
    else:
        raise ValueError(f"unknown mode: {mode}")

    out = img.resize((size, size), Image.LANCZOS)
    path = OUT_DIR / f"icon{size}-{mode}.png"
    out.save(path, "PNG")

    # Also keep icon{size}.png as a mode-agnostic alias of the "off" state for
    # legacy manifest entries and install-time display.
    if mode == "off":
        alias = OUT_DIR / f"icon{size}.png"
        out.save(alias, "PNG")

    print(f"wrote {path}")
    return path


def main() -> None:
    for size in (16, 32, 48, 128):
        for mode in MODES:
            render(size, mode)


if __name__ == "__main__":
    main()
