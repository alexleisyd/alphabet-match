#!/bin/sh
# Build the signed Android App Bundle that Play Console wants.
#
#   npm run aab        # sync the web files first, then this
#
# Play takes an .aab, not an .apk: Google resigns and re-splits it per device,
# which is also why the signing below is only the *upload* key. The one you
# ship with and the one users verify against are deliberately different keys.
set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PROPS="$ROOT/android/keystore.properties"

if [ ! -f "$PROPS" ]; then
  cat >&2 <<MSG
No android/keystore.properties — the bundle would come out unsigned and Play
would reject it. Copy android/keystore.properties.example and fill it in; the
comments in that file include the keytool command that makes the keystore.
MSG
  exit 1
fi

cd "$ROOT/android"
./gradlew --quiet bundleRelease

AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
[ -f "$AAB" ] || { echo "gradle finished but produced no bundle at $AAB" >&2; exit 1; }

echo
echo "bundle: $AAB"
echo "  size: $(du -h "$AAB" | awk '{print $1}')"

# Gradle signs silently and, if the config were skipped, would silently not.
# An unsigned bundle looks identical until Play rejects the upload, so check
# here rather than finding out in a browser.
if command -v jarsigner >/dev/null 2>&1; then
  # Match the words, not the exit status: `jarsigner -verify` prints "jar is
  # unsigned." and still exits 0, so a status check here passes an artifact
  # Play will refuse.
  if jarsigner -verify "$AAB" 2>&1 | grep -q "jar verified"; then
    echo "  signed: yes"
    # The fingerprint Play Console shows under "Upload key certificate". Worth
    # eyeballing once, because signing with the wrong key is rejected with a
    # message that names only the expected hash.
    keytool -printcert -jarfile "$AAB" 2>/dev/null \
      | awk '/SHA256:/ {print "  upload-key SHA-256: " $2; exit}'
  else
    echo "  signed: NO — check android/keystore.properties" >&2
    exit 1
  fi
fi

echo
echo "Upload this file to Play Console > Production (or Internal testing)."
