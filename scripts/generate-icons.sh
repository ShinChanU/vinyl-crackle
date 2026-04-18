#!/usr/bin/env bash
# Regenerate toolbar icons with a perfectly centered vinyl + orange label.
set -euo pipefail

OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/icons"
mkdir -p "$OUT_DIR"

render() {
  local size=$1
  local out="$OUT_DIR/icon${size}.png"

  # Render at 8x for anti-aliasing, then downscale.
  local big=$(( size * 8 ))
  local c=$(( big / 2 ))          # center (integer → exact pixel center)
  local disc=$(( big * 47 / 100 ))   # disc radius (outer)
  local ring=$(( big * 35 / 100 ))   # subtle groove ring radius
  local label=$(( big * 22 / 100 ))  # orange label radius
  local hole=$(( big *  3 / 100 ))   # center hole radius

  magick -size ${big}x${big} xc:none \
    -fill "#141414" -stroke none \
      -draw "circle ${c},${c} ${c},$(( c - disc ))" \
    -fill none -stroke "#2a2a2a" -strokewidth $(( big / 180 + 1 )) \
      -draw "circle ${c},${c} ${c},$(( c - ring ))" \
    -fill "#c97d3a" -stroke none \
      -draw "circle ${c},${c} ${c},$(( c - label ))" \
    -fill "#141414" -stroke none \
      -draw "circle ${c},${c} ${c},$(( c - hole ))" \
    -filter Lanczos -resize ${size}x${size} \
    "$out"

  echo "wrote $out"
}

render 16
render 48
render 128
