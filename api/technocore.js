export default async function handler(req, res) {
  const room =
    typeof req.query.room === "string" ? req.query.room : "lobby";

  const since =
    typeof req.query.since === "string" ? req.query.since : "0";

  const limit = Math.min(
    Math.max(Number(req.query.limit) || 50, 1),
    200
  );

  if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(room)) {
    return res.status(400).json({
      ok: false,
      error: "Invalid room"
    });
  }

  const url =
    `https://technocore.chat/r/${encodeURIComponent(room)}` +
    `?format=json&since=${encodeURIComponent(since)}` +
    `&limit=${limit}&n=${Date.now()}`;

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "FLOP-Community-Observatory/1.0"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(200).json({
        ok: false,
        available: false,
        upstreamStatus: upstream.status,
        error: "Technocore temporarily unavailable",
        detail: text.slice(0, 500),
        room,
        fetchedAt: new Date().toISOString()
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({
        ok: false,
        available: false,
        error: "Unexpected upstream response",
        room,
        fetchedAt: new Date().toISOString()
      });
    }

    return res.status(200).json({
      ok: true,
      available: true,
      source: "https://technocore.chat",
      room,
      data,
      fetchedAt: new Date().toISOString()
    });

  } catch (err) {
    clearTimeout(timeout);

    const message =
      err?.name === "AbortError"
        ? "Technocore request timed out"
        : String(err?.message || err);

    return res.status(200).json({
      ok: false,
      available: false,
      error: "Unable to reach Technocore",
      detail: message,
      room,
      fetchedAt: new Date().toISOString()
    });
  }
}
