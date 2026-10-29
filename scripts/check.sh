#!/bin/sh
# dsh-browser-use preflight: checks the runtime pieces this bundle needs.
set -u

echo "dsh-browser-use preflight"
echo "-------------------------"

if command -v node >/dev/null 2>&1; then
  echo "node:       $(node --version)"
else
  echo "node:       NOT FOUND (DSH ships its own runtime; this check is informational)"
fi

found=0
for p in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  "/usr/bin/google-chrome" \
  "/usr/bin/chromium"; do
  if [ -x "$p" ]; then
    echo "browser:    $p"
    found=1
  fi
done

if [ "$found" -eq 0 ]; then
  echo "browser:    no Chrome/Chromium found in known paths."
  echo "            Set executablePath in your profile patch, or install Playwright Chromium:"
  echo "            npx playwright install chromium"
fi

echo
echo "Next: install this bundle with DSH Plugin Manager, then open a NEW chat."
