#!/bin/bash
# Script to add Google Calendar OAuth environment variables to Vercel
# Run this from your project root after installing Vercel CLI

echo "Adding Google Calendar OAuth environment variables to Vercel..."
echo ""
echo "Make sure you have Vercel CLI installed: npm i -g vercel"
echo "And that you're logged in: vercel login"
echo ""

# Add GOOGLE_CLIENT_ID
echo "Adding GOOGLE_CLIENT_ID..."
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID production
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID preview
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID development

# Add GOOGLE_CLIENT_SECRET
echo "Adding GOOGLE_CLIENT_SECRET..."
echo "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" | vercel env add GOOGLE_CLIENT_SECRET production
echo "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" | vercel env add GOOGLE_CLIENT_SECRET preview
echo "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" | vercel env add GOOGLE_CLIENT_SECRET development

# Add GOOGLE_REDIRECT_URI
echo "Adding GOOGLE_REDIRECT_URI..."
echo "https://pca-app-eta.vercel.app/api/auth/google/callback" | vercel env add GOOGLE_REDIRECT_URI production
echo "https://pca-app-eta.vercel.app/api/auth/google/callback" | vercel env add GOOGLE_REDIRECT_URI preview
echo "http://localhost:3000/api/auth/google/callback" | vercel env add GOOGLE_REDIRECT_URI development

echo ""
echo "Done! Now redeploy your Vercel app for the changes to take effect."
