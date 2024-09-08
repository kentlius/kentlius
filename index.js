const { createServer } = require("node:http");
const { URLSearchParams } = require("url");

const hostname = "localhost";
const port = 3000;

const getSpotifyAccessToken = async (
  client_id,
  client_secret,
  refresh_token
) => {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${client_id}:${client_secret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Spotify token: ${res.statusText}`);
  }

  const tokenData = await res.json();

  return tokenData.access_token;
};

const getCurrentlyPlayingSong = async (accessToken) => {
  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch currently playing song: ${res.statusText}`
    );
  }

  const songData = await res.json();

  return songData;
};

const convertToBase64 = async (url) => {
  const buff = await (await fetch(url)).arrayBuffer();
  return `data:image/jpeg;base64,${Buffer.from(buff).toString("base64")}`;
};

const generateBadgeSvg = (albumImg, artist, track, progress, duration) => {
  const progressPercentage = (progress / duration) * 180;
  const remainingDuration = (duration - progress) / 1000;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100" fill="none">
        <!-- Background -->
        <rect width="300" height="100" rx="10" fill="#1DB954"/>

        <!-- Album Art -->
        <image href="${albumImg}" x="10" y="10" width="80" height="80" rx="5"/>

        <!-- Track Info -->
        <text x="100" y="40" font-family="Arial, sans-serif" font-size="14" fill="white">${track}</text>
        <text x="100" y="60" font-family="Arial, sans-serif" font-size="12" fill="white">by ${artist}</text>

        <!-- Progress Bar Background -->
        <rect x="100" y="80" width="180" height="6" fill="#ffffff33" rx="3"/>

        <!-- Animated Progress Bar -->
        <rect x="100" y="80" width="${progressPercentage}" height="6" fill="white" rx="3">
            <animate attributeName="width" from="${progressPercentage}" to="180" dur="${remainingDuration}s" fill="freeze" />
        </rect>
    </svg>
  `;
};

const generateDefaultBadgeSvg = () => `
  <svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100" fill="none">
      <!-- Background -->
      <rect width="300" height="100" rx="10" fill="#1DB954"/>

      <!-- Placeholder Album Art -->
      <rect x="10" y="10" width="80" height="80" fill="white" rx="5"/>

      <!-- Default Text -->
      <text x="100" y="50" font-family="Arial, sans-serif" font-size="14" fill="white">No song currently playing</text>
  </svg>
`;

const handleRequest = async (req, res) => {
  try {
    const {
      SPOTIFY_CLIENT_ID: client_id,
      SPOTIFY_CLIENT_SECRET: client_secret,
      SPOTIFY_REFRESH_TOKEN: refresh_token,
    } = process.env;

    if (!refresh_token || !client_id || !client_secret) {
      throw new Error("Missing Spotify credentials");
    }

    const accessToken = await getSpotifyAccessToken(
      client_id,
      client_secret,
      refresh_token
    );

    const songData = await getCurrentlyPlayingSong(accessToken);

    const isPlaying = songData.is_playing;

    if (!isPlaying) {
      const defaultBadge = generateDefaultBadgeSvg();
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/svg+xml");
      return res.end(defaultBadge);
    }

    const track = songData.item;
    const artist = track.artists.map((artist) => artist.name).join(", ");
    const trackName = track.name;
    const progress = songData.progress_ms;
    const duration = track.duration_ms;

    let albumImg = track.album.images[1].url;
    albumImg = await convertToBase64(albumImg);

    const badge = generateBadgeSvg(
      albumImg,
      artist,
      trackName,
      progress,
      duration
    );

    res.statusCode = 200;
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(badge);
  } catch (error) {
    console.error("Error occurred:", error);

    const defaultBadge = generateDefaultBadgeSvg();
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(defaultBadge);
  }
};

const server = createServer(handleRequest);

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});
