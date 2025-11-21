#!/bin/sh

CHROME=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
PROFDIR=/tmp/adndev

set -e

#tools/make-chromium.sh

rm -rf "$PROFDIR"-bak 2>/dev/null
mv "$PROFDIR"/ "$PROFDIR"-bak 2>/dev/null

pushd dist/build/adnauseam.chromium 2>/dev/null

"$CHROME" --no-default-browser-check --no-first-run --user-data-dir="$PROFDIR" --load-extension=. ----disable-extensions-except=.

"/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --no-default-browser-check --user-data-dir=/tmp/adndev --load-extension=. --no-first-run --disable-extensions-except=."

popd  2>/dev/null
