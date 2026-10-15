#!/bin/sh
# Headless capture harness: boots Galaxy Arena 2 in headless Chrome with WebGPU, saves screenshots at fixed views,
# and prints any console errors. Run from the galaxy-arena-2 folder with a local server on port 8767 serving its parent.
#   python3 -m http.server 8767   (from the folder above galaxy-arena-2)
#   sh tools/harness.sh
# Headless Chrome has no real frame clock, so captures use ?nofade (orbs at full brightness) and timings are not meaningful.
OUT=${OUT:-/tmp/ga2-harness}; mkdir -p "$OUT"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE="http://localhost:8767/galaxy-arena-2/index.html"
shot() { name=$1; q=$2
  "$CHROME" --headless=new --enable-unsafe-webgpu --enable-logging=stderr --user-data-dir="$OUT/profile-$name" \
    --window-size=1280,800 --virtual-time-budget=6000 --screenshot="$OUT/$name.png" "$BASE?$q&t=$name" 2> "$OUT/$name.log"
  errs=$(grep -h "Uncaught\|WGSL\|Shader\|Error:" "$OUT/$name.log" | grep -v "cv_display\|gcm" | head -3)
  echo "$name: $( [ -s "$OUT/$name.png" ] && echo ok || echo NO IMAGE ) ${errs:+· $errs}"
}
shot home ""
shot intro "autoplay&stats"
shot close "autoplay&nointro&nofade&mass=400&z=1.6"
shot mid "autoplay&nointro&nofade&mass=400&z=40"
shot far "autoplay&nointro&nofade&z=99999"
echo "screenshots in $OUT"
