export default async function handler(req, res) {
  const room = typeof req.query.room === "string" ? req.query.room : "lobby";
  const since = typeof req.query.since === "string" ? req.query.since : "0";
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

  if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(room)) {
    return res.status(400).json({ ok: false, error: "Invalid room" });
  }

  const url = `https://technocore.chat/r/${encodeURIComponent(room)}?format=json&since=${encodeURIComponent(since)}&limit=${limit}&n=${Date.now()}`;

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "FLOP-Community-Observatory/1.0" }
    });
    const text = await upstream.text();

    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        error: `Technocore returned ${upstream.status}`,
        detail: text.slice(0, 500)
      });
    }

    let data;
    try { data = JSON.parse(text); }
    catch {
      return res.status(502).json({ ok: false, error: "Unexpected upstream response" });
    }

    return res.status(200).json({
      ok: true,
      source: "https://technocore.chat",
      room,
      data,
      fetchedAt: new Date().toISOString()
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: "Unable to reach Technocore",
      detail: String(err?.message || err)
    });
  }
}