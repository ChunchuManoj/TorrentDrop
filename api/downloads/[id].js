export default function handler(_request, response) {
  response.status(501).json({
    error: "The Vercel frontend has no persistent torrent job manager. Configure the separate Node backend before starting downloads.",
  });
}
