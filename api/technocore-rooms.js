export default async function handler(req, res) {
  try {
    const upstream = await fetch(`https://technocore.chat/rooms?format=json&limit=50&n=${Date.now()}`, {
      headers: { "User-Agent": "FLOP-Community-Observatory/1.0" }
    });
    const text = await upstream.text();
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (!upstream.ok) return res.status(upstream.status).json({ok:false,error:`Technocore returned ${upstream.status}`});
    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ok:false,error:"Unexpected room index response"}); }
    return res.status(200).json({ok:true,data,fetchedAt:new Date().toISOString()});
  } catch (e) {
    return res.status(502).json({ok:false,error:"Unable to reach Technocore"});
  }
}