#!/bin/sh
# Render assets/source.html into the four PNGs @capacitor/assets consumes,
# then let it cut the ~40 platform sizes from them.
#
# Headless Chrome rather than a converter: the source is a web page using the
# same CSS the game uses, so the only renderer guaranteed to agree with the
# game is a browser. It also gives us real transparency for the adaptive
# icon's foreground layer, which ImageMagick's SVG path would not.
set -e

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "no Chrome at $CHROME (set CHROME=...)" >&2; exit 1; }

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SRC="file://$ROOT/assets/source.html"
OUT="$ROOT/assets"

shoot() {   # shoot <hash> <size> <file> [transparent]
  bg=""
  [ "$4" = "transparent" ] && bg="--default-background-color=00000000"
  "$CHROME" --headless --disable-gpu --hide-scrollbars $bg \
    --force-device-scale-factor=1 \
    --window-size="$2,$2" \
    --screenshot="$OUT/$3" \
    "$SRC#$1" >/dev/null 2>&1
  echo "  $3  ${2}x${2}"
}

echo "rendering source artwork:"
shoot icon       1024 icon.png
shoot foreground 1024 icon-foreground.png transparent
shoot background 1024 icon-background.png
shoot splash     2732 splash.png
# The game has no night mode; a dark splash would flash one theme and open in
# another. Same artwork for both, deliberately.
cp "$OUT/splash.png" "$OUT/splash-dark.png"
echo "  splash-dark.png  2732x2732 (copy of splash.png — see comment)"

mkdir -p "$ROOT/store"

# Play wants the launcher icon uploaded separately, at exactly 512x512, and
# shows it beside the listing. Rendered at that size rather than downscaled
# from the 1024 above, so the type and the tile's edge stay crisp. (Apple needs
# no equivalent upload: App Store Connect reads the 1024 icon out of the build's
# asset catalog, which @capacitor/assets has already filled in below.)
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=512,512 \
  --screenshot="$ROOT/store/play-icon-512.png" \
  "$SRC#icon" >/dev/null 2>&1
echo "  store/play-icon-512.png  512x512"

# Play's feature graphic. Not an icon and not a screenshot, so @capacitor/assets
# never sees it — it goes straight to store/ alongside the screenshots, which
# is the folder someone filling in the listing is already looking at. It is the
# only target that isn't square and the only one carrying the app's name.
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1024,500 \
  --screenshot="$ROOT/store/feature-graphic.png" \
  "$SRC#feature" >/dev/null 2>&1
echo "  store/feature-graphic.png  1024x500"

# Play can crop this one toward the middle and lay its own title over it, so
# nothing may sit in the outer tenth. Ink is near-black and the sky is pale, so
# a darkest-pixel reading of the border says whether anything strayed into it.
if command -v magick >/dev/null 2>&1; then
  edge=$(magick "$ROOT/store/feature-graphic.png" -fill '#e9fbf0' \
                -draw "rectangle 102,50 922,450" -colorspace Gray -format "%[fx:minima]" info:)
  echo "  safe-area check: darkest pixel outside the middle 80% is $edge (want > 0.6)"
fi

# The lockup is lifted to compensate for its drop shadows; this is the check
# that says whether the lift is still right. Top and bottom margins should be
# within a few pixels of each other.
if command -v magick >/dev/null 2>&1; then
  box=$(magick "$OUT/icon-foreground.png" -trim -format "%w %h %X %Y" info:)
  set -- $box
  echo "  centring check: ink ${1}x${2}, top $4, bottom $((1024 - $4 - $2))"
fi

echo "generating platform sizes:"
cd "$ROOT"
npx --yes @capacitor/assets generate --iconBackgroundColor '#c9ecff' \
                                     --iconBackgroundColorDark '#c9ecff' \
                                     --splashBackgroundColor '#c9ecff' \
                                     --splashBackgroundColorDark '#c9ecff'

# @capacitor/assets wraps both adaptive-icon layers in a 16.7% inset. On the
# foreground that is only redundant — ours is already framed for the mask —
# but on the background it is wrong: it shrinks the sky inside the mask
# window, and the launcher fills the ring it leaves behind with a colour it
# samples from the icon. The result is a yellow doughnut around the app on the
# home screen. Both layers want to be full bleed, so the insets come off.
# @capacitor/assets also writes a PWA icon set at the repo root. Nothing here
# is a PWA — there is no manifest and no service worker — so it is litter.
rm -rf "$ROOT/icons"

# The dark splash is a byte-for-byte copy of the light one, on purpose (see
# above), and the generator dutifully writes a full set of both. That is ~10MB
# of duplicate gradient in an app whose entire voice pack is 4.6MB — on Android
# it was half the APK. Both platforms fall back to the light resource when the
# dark one is absent, so the copies come straight back out.
echo "dropping the duplicate dark splash:"
before=$(du -sk "$ROOT/android/app/src/main/res" "$ROOT/ios/App/App/Assets.xcassets" | awk '{s+=$1} END {print s}')
rm -rf "$ROOT"/android/app/src/main/res/drawable*night*/
rm -f  "$ROOT"/ios/App/App/Assets.xcassets/Splash.imageset/*-dark.png
python3 - "$ROOT/ios/App/App/Assets.xcassets/Splash.imageset/Contents.json" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
d["images"] = [i for i in d["images"] if not i.get("appearances")]
json.dump(d, open(p, "w"), indent=2)
PY
after=$(du -sk "$ROOT/android/app/src/main/res" "$ROOT/ios/App/App/Assets.xcassets" | awk '{s+=$1} END {print s}')
echo "  artwork on disk: ${before}KB -> ${after}KB"

echo "flattening the adaptive-icon insets:"
for f in "$ROOT"/android/app/src/main/res/mipmap-anydpi-v26/ic_launcher*.xml; do
  cat > "$f" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by tools/artwork.sh. Both layers are full bleed on purpose;
     see the comment in that script before adding an inset back. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
XML
  echo "  $(basename "$f")"
done
