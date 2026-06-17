#!/usr/bin/env bash
set -euo pipefail

echo "=== Packaging APK assets ==="

PROJECT_DIR="$(pwd)"
ASSETS_DIR="$PROJECT_DIR/android/app/src/main/assets"
rm -rf "$ASSETS_DIR"

# 直接把 dist/ 文件复制到 assets/www/（不经过 zip，避免丢失文件）
echo "Copying frontend files to assets/www/..."
if [ ! -d "$PROJECT_DIR/dist" ]; then
    echo "ERROR: dist/ not found! Run npm run build first."
    exit 1
fi

mkdir -p "$ASSETS_DIR/www"
cp -r "$PROJECT_DIR/dist/"* "$ASSETS_DIR/www/"

# 验证
echo ""
echo "=== Files in assets/www/ ==="
find "$ASSETS_DIR/www" -type f | while read f; do
    echo "  ${f#$ASSETS_DIR/www/} ($(stat -c%s "$f") bytes)"
done

JS_COUNT=$(find "$ASSETS_DIR/www" -name "*.js" | wc -l)
CSS_COUNT=$(find "$ASSETS_DIR/www" -name "*.css" | wc -l)
HTML_COUNT=$(find "$ASSETS_DIR/www" -name "*.html" | wc -l)

echo ""
echo "=== Summary ==="
echo "  JS files: $JS_COUNT"
echo "  CSS files: $CSS_COUNT"
echo "  HTML files: $HTML_COUNT"

if [ "$JS_COUNT" -eq 0 ]; then
    echo "ERROR: No JS files found in dist/! Frontend build may have failed."
    exit 1
fi

echo ""
echo "=== Packaging complete! ==="
