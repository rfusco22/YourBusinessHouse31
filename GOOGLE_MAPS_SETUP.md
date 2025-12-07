# Google Maps API - Secure Setup

## Overview

This application uses Google Maps API securely without exposing the API key in client-side code.

## How It Works

1. **Server-Side API Route**: `/app/api/google-maps-config/route.ts`
   - Stores the API key securely in `GOOGLE_MAPS_API_KEY` environment variable
   - Returns the Google Maps script URL with the key embedded

2. **Client-Side Loader**: `/components/google-maps-loader.tsx`
   - Fetches the script URL from the server
   - Dynamically loads the Google Maps script
   - Does not expose the API key in the client bundle

3. **Integration**: The `GoogleMapsLoader` is wrapped around the app in `/app/providers.tsx`

## Environment Variable

In Railway (or your deployment platform), set:

\`\`\`
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
\`\`\`

**Important**: Use the server-only variable name above (without any NEXT_PUBLIC prefix) to keep the key secure.

## Migration Notes

- **Removed**: Old files that exposed the API key in client code
- **Removed**: All public environment variable references
- **Added**: Secure server-side API route for Google Maps configuration
- **Added**: Client-side loader component that fetches configuration safely

## Verification

To verify the API key is not exposed:
1. Build the project: `npm run build`
2. Check the client bundle - the API key should not appear anywhere
3. The key only exists in server-side code and environment variables
