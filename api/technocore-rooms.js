import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch(
      `https://technocore.chat/rooms?format=json&limit=200&n=${Date.now()}`,
      {
        headers: {
          "User-Agent": "FLOP-Community-Observatory/1.0"
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    const text = await upstream.text();

    if (!upstream.ok) {
      return res.status(200).json({
        ok: true,
        available: false,
        fallback: true,
        rooms: [],
        upstreamStatus: upstream.status,
        fetchedAt: new Date().toISOString()
      });
    }

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(200).json({
        ok: true,
        available: false,
        fallback: true,
        rooms: [],
        error: "Unexpected room index response",
        fetchedAt: new Date().toISOString()
      });
    }

    return res.status(200).json({
      ok: true,
      available: true,
      source: "https://technocore.chat/rooms",
      data,
      fetchedAt: new Date().toISOString()
    });

  } catch (err) {
    clearTimeout(timeout);

    return res.status(200).json({
      ok: true,
      available: false,
      fallback: true,
      rooms: [],
      error:
        err?.name === "AbortError"
          ? "Technocore room index timed out"
          : "Unable to reach Technocore room index",
      fetchedAt: new Date().toISOString()
    });
  }
}
