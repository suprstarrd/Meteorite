#!/usr/bin/env bash
#
# This script assumes a linux environment

set -e
shopt -s extglob

echo "*** AdNauseamLite.mv3: Creating extension"

PLATFORM="chromium"

for i in "$@"; do
  case $i in
    full)
      FULL="yes"
      ;;
    firefox)
      PLATFORM="firefox"
      ;;
    chromium)
      PLATFORM="chromium"
      ;;
    edge)
      PLATFORM="edge"
      ;;
    safari)
      PLATFORM="safari"
      ;;
    +([0-9]).+([0-9]).+([0-9]))
      TAGNAME="$i"
      FULL="yes"
      ;;
    before=+([[:print:]]))
      BEFORE="${i:7}"
      ;;
  esac
done

echo "PLATFORM=$PLATFORM"
echo "TAGNAME=$TAGNAME"
echo "BEFORE=$BEFORE"

ADNL_DIR="dist/build/ADNLite.$PLATFORM"

if [ "$PLATFORM" = "edge" ]; then
    MANIFEST_DIR="chromium"
else
    MANIFEST_DIR="$PLATFORM"
fi

rm -rf $ADNL_DIR

mkdir -p $ADNL_DIR
cd $ADNL_DIR
ADNL_DIR=$(pwd)
cd - > /dev/null

mkdir -p "$ADNL_DIR"/css/fonts
mkdir -p "$ADNL_DIR"/js
mkdir -p "$ADNL_DIR"/img

if [ -n "$ADN_VERSION" ]; then
    ADN_REPO="https://github.com/dhowe/AdNauseam.git"
    ADN_DIR=$(mktemp -d)
    echo "*** AdNauseamLite.mv3: Fetching uBO $ADN_VERSION from $ADN_REPO into $ADN_DIR"
    cd "$ADN_DIR"
    git init -q
    git remote add origin "https://github.com/dhowe/AdNauseam.git"
    git fetch --depth 1 origin "$ADN_VERSION"
    git checkout -q FETCH_HEAD
    cd - > /dev/null
else
    ADN_DIR=.
fi

echo "*** uBOLite.mv3: Copying common files"
cp -R "$ADN_DIR"/src/css/fonts/Inter "$ADNL_DIR"/css/fonts/
cp "$ADN_DIR"/src/css/themes/default.css "$ADNL_DIR"/css/
cp "$ADN_DIR"/src/css/common.css "$ADNL_DIR"/css/
cp "$ADN_DIR"/src/css/dashboard-common.css "$ADNL_DIR"/css/
cp "$ADN_DIR"/src/css/fa-icons.css "$ADNL_DIR"/css/

cp "$ADN_DIR"/src/js/arglist-parser.js "$ADNL_DIR"/js/
cp "$ADN_DIR"/src/js/dom.js "$ADNL_DIR"/js/
cp "$ADN_DIR"/src/js/fa-icons.js "$ADNL_DIR"/js/
cp "$ADN_DIR"/src/js/i18n.js "$ADNL_DIR"/js/
cp "$ADN_DIR"/src/js/jsonpath.js "$ADNL_DIR"/js/
cp "$ADN_DIR"/src/js/redirect-resources.js "$ADNL_DIR"/js/
cp "$ADN_DIR"/src/js/static-filtering-parser.js "$ADNL_DIR"/js/
cp "$ADN_DIR"/src/js/urlskip.js "$ADNL_DIR"/js/
cp "$ADN_DIR"/src/lib/punycode.js "$ADNL_DIR"/js/

cp -R "$ADN_DIR/src/img/flags-of-the-world" "$ADNL_DIR"/img

cp LICENSE.txt "$ADNL_DIR"/

echo "*** uBOLite.mv3: Copying mv3-specific files"
cp platform/mv3/"$MANIFEST_DIR"/manifest.json "$ADNL_DIR"/
cp platform/mv3/extension/*.html "$ADNL_DIR"/
cp platform/mv3/extension/*.json "$ADNL_DIR"/
cp platform/mv3/extension/css/* "$ADNL_DIR"/css/
cp -R platform/mv3/extension/js/* "$ADNL_DIR"/js/
cp platform/mv3/"$PLATFORM"/ext-compat.js "$ADNL_DIR"/js/ 2>/dev/null || :
cp platform/mv3/"$PLATFORM"/css-api.js "$ADNL_DIR"/js/scripting/ 2>/dev/null || :
cp platform/mv3/"$PLATFORM"/css-user.js "$ADNL_DIR"/js/scripting/ 2>/dev/null || :
cp platform/mv3/extension/img/* "$ADNL_DIR"/img/
cp platform/mv3/"$PLATFORM"/img/* "$ADNL_DIR"/img/ 2>/dev/null || :
cp -R platform/mv3/extension/_locales "$ADNL_DIR"/
cp platform/mv3/README.md "$ADNL_DIR/"

# Libraries
mkdir -p "$ADNL_DIR"/lib/codemirror
cp platform/mv3/extension/lib/codemirror/* \
    "$ADNL_DIR"/lib/codemirror/ 2>/dev/null || :
cp platform/mv3/extension/lib/codemirror/codemirror-ubol/dist/cm6.bundle.ubol.min.js \
    "$ADNL_DIR"/lib/codemirror/
cp platform/mv3/extension/lib/codemirror/codemirror.LICENSE \
    "$ADNL_DIR"/lib/codemirror/
cp platform/mv3/extension/lib/codemirror/codemirror-ubol/LICENSE \
    "$ADNL_DIR"/lib/codemirror/codemirror-quickstart.LICENSE
mkdir -p "$ADNL_DIR"/lib/csstree
cp "$ADN_DIR"/src/lib/csstree/* "$ADNL_DIR"/lib/csstree/

echo "*** uBOLite.mv3: Generating rulesets"
UBOL_BUILD_DIR=$(mktemp -d)
mkdir -p "$UBOL_BUILD_DIR"
./tools/make-nodejs.sh "$UBOL_BUILD_DIR"
cp platform/mv3/*.json "$UBOL_BUILD_DIR"/
cp platform/mv3/*.js "$UBOL_BUILD_DIR"/
cp platform/mv3/*.mjs "$UBOL_BUILD_DIR"/
cp platform/mv3/extension/js/utils.js "$UBOL_BUILD_DIR"/js/
cp -R "$ADN_DIR"/src/js/resources "$UBOL_BUILD_DIR"/js/
cp -R platform/mv3/scriptlets "$UBOL_BUILD_DIR"/
mkdir -p "$UBOL_BUILD_DIR"/web_accessible_resources
cp "$ADN_DIR"/src/web_accessible_resources/* "$UBOL_BUILD_DIR"/web_accessible_resources/
cp -R platform/mv3/"$PLATFORM" "$UBOL_BUILD_DIR"/

cd "$UBOL_BUILD_DIR"
node --no-warnings make-rulesets.js output="$ADNL_DIR" platform="$PLATFORM"
if [ -n "$BEFORE" ]; then
    echo "*** uBOLite.mv3: salvaging rule ids to minimize diff size"
    echo "    before=$BEFORE/$PLATFORM"
    echo "    after=$ADNL_DIR"
    node salvage-ruleids.mjs before="$BEFORE"/"$PLATFORM" after="$ADNL_DIR"
fi
cd - > /dev/null
rm -rf "$UBOL_BUILD_DIR"

echo "*** uBOLite.$PLATFORM: extension ready"
echo "Extension location: $ADNL_DIR/"

# Local build
tmp_manifest=$(mktemp)
chmod '=rw' "$tmp_manifest"
if [ -z "$TAGNAME" ]; then
    TAGNAME="$(jq -r .version "$ADNL_DIR"/manifest.json)"
    # Enable DNR rule debugging
    jq '.permissions += ["declarativeNetRequestFeedback"]' \
        "$ADNL_DIR/manifest.json" > "$tmp_manifest" \
        && mv "$tmp_manifest" "$ADNL_DIR/manifest.json"
    # Use a different extension id than the official one
    if [ "$PLATFORM" = "firefox" ]; then
        jq '.browser_specific_settings.gecko.id = "uBOLite.dev@raymondhill.net"' "$ADNL_DIR/manifest.json"  > "$tmp_manifest" \
            && mv "$tmp_manifest" "$ADNL_DIR/manifest.json"
    fi
else
    jq --arg version "${TAGNAME}" '.version = $version' "$ADNL_DIR/manifest.json"  > "$tmp_manifest" \
        && mv "$tmp_manifest" "$ADNL_DIR/manifest.json"
fi

# Platform-specific steps
if [ "$PLATFORM" = "edge" ]; then
    # For Edge, declared rulesets must be at package root
    echo "*** uBOLite.edge: Modify reference implementation for Edge compatibility"
    mv "$ADNL_DIR"/rulesets/main/* "$ADNL_DIR/"
    rmdir "$ADNL_DIR/rulesets/main"
    node platform/mv3/edge/patch-extension.js packageDir="$ADNL_DIR"
elif [ "$PLATFORM" = "safari" ]; then
    # For Safari, we must fix the package for compliance
    node platform/mv3/safari/patch-extension.js packageDir="$ADNL_DIR"
fi

if [ "$FULL" = "yes" ]; then
    EXTENSION="zip"
    if [ "$PLATFORM" = "firefox" ]; then
        EXTENSION="xpi"
    fi
    echo "*** uBOLite.mv3: Creating publishable package..."
    UBOL_PACKAGE_NAME="uBOLite_$TAGNAME.$PLATFORM.$EXTENSION"
    UBOL_PACKAGE_DIR=$(mktemp -d)
    mkdir -p "$UBOL_PACKAGE_DIR"
    cp -R "$ADNL_DIR"/* "$UBOL_PACKAGE_DIR"/
    cd "$UBOL_PACKAGE_DIR" > /dev/null
    rm -f ./log.txt
    zip "$UBOL_PACKAGE_NAME" -qr ./*
    cd - > /dev/null
    cp "$UBOL_PACKAGE_DIR"/"$UBOL_PACKAGE_NAME" dist/build/
    rm -rf "$UBOL_PACKAGE_DIR"
    echo "Package location: $(pwd)/dist/build/$UBOL_PACKAGE_NAME"
fi
