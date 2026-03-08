#!/bin/bash
set -e

echo "🚀 Deploying to Vercel..."
OUTPUT=$(vercel --prod 2>&1)
echo "$OUTPUT"

# Extract the deployment URL from the output
URL=$(echo "$OUTPUT" | grep "Production:" | awk '{print $2}')

if [ -z "$URL" ]; then
  echo "❌ Could not extract deployment URL"
  exit 1
fi

echo ""
echo "📌 Aliasing $URL → jabsypicks.com"
vercel alias "$URL" jabsypicks.com

echo "📌 Aliasing $URL → jabsy.vercel.app"
vercel alias "$URL" jabsy.vercel.app

echo ""
echo "✅ Done! https://jabsypicks.com is live"
