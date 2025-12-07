// Server-side route to provide Google Maps configuration without exposing the API key
export async function GET() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return Response.json({ error: "Google Maps API key not configured" }, { status: 500 })
  }

  return Response.json({
    scriptUrl: `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`,
  })
}
