export default function handler(_request, response) {
  response.status(501).json({
    error: "Torrent downloads require the persistent Node backend. Deploy server.mjs on a VPS, Railway, Render, or Fly.io and set the frontend API URL.",
  });
}
