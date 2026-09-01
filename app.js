const state = {
  room: "lobby",
  since: 0,
  messages: [],
  connected: false,
  did: localStorage.getItem("flopDid") || "",
};

const $ = (id) => document.getElementById(id);

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function normalizeMessages(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function shortDid(v) {
  const s = String(v || "");
  return s.length > 24 ? `${s.slice(0, 12)}…${s.slice(-7)}` : s;
}

function renderFeed() {
  const feed = $("activityFeed");
  if (!state.messages.length) {
    feed.innerHTML = `<div class="empty">No public telemetry returned.</div>`;
    return;
  }
  const rows = [...state.messages].sort((a,b) => Number(b.seq||0)-Number(a.seq||0)).slice(0, 50);
  feed.innerHTML = rows.map(m => {
    const from = m.from || m.nick || "unknown";
    const text = m.text || "";
    return `<div class="feed-row">
      <div class="seq">#${escapeHtml(m.seq ?? "—")}</div>
      <div class="feed-main">
        <div class="writer">${escapeHtml(shortDid(from))}</div>
        <div class="message">${escapeHtml(text)}</div>
        <div class="time">${escapeHtml(m.ts || "timestamp unavailable")}</div>
      </div>
    </div>`;
  }).join("");
}

function renderStats() {
  const writers = new Set(state.messages.map(m => m.from || m.nick).filter(Boolean));
  const now = Date.now();
  const active = new Set(state.messages.filter(m => {
    const t = Date.parse(m.ts || "");
    return Number.isFinite(t) ? now - t <= 10 * 60 * 1000 : false;
  }).map(m => m.from || m.nick).filter(Boolean));

  $("uniqueCount").textContent = writers.size || "—";
  $("activeCount").textContent = active.size || (state.messages.length ? "0" : "—");
  $("messageCount").textContent = state.messages.length || "—";
  const latest = state.messages.reduce((x,m) => Math.max(x, Number(m.seq)||0), 0);
  $("latestSeq").textContent = latest ? latest.toLocaleString() : "—";
  $("signalMessages").textContent = state.messages.length || "—";
  $("signalSeq").textContent = latest ? latest.toLocaleString() : "—";
  $("networkSeq").textContent = latest ? latest.toLocaleString() : "—";

  $("connectionBadge").innerHTML = state.connected
    ? `<span class="pulse"></span> LIVE`
    : `<span class="pulse" style="background:var(--bad);box-shadow:0 0 12px var(--bad)"></span> OFFLINE`;
  $("topStatus").style.color = state.connected ? "var(--good)" : "var(--bad)";
  $("pulseText").textContent = state.connected ? "Public telemetry connected" : "Telemetry unavailable";

  const bars = $("signalBars");
  const count = Math.max(1, Math.min(70, state.messages.length));
  bars.innerHTML = Array.from({length: count}, (_,i) => {
    const m = state.messages[state.messages.length - count + i];
    const h = 12 + ((Number(m?.seq || i) * 17) % 80);
    return `<span class="bar" style="height:${h}%"></span>`;
  }).join("");
}

function renderAgents() {
  const map = new Map();
  state.messages.forEach(m => {
    const from = m.from || m.nick;
    if (!from) return;
    const old = map.get(from);
    if (!old || Number(m.seq||0) > Number(old.seq||0)) map.set(from, m);
  });
  const list = [...map.values()].sort((a,b) => Number(b.seq||0)-Number(a.seq||0));
  $("agentsList").innerHTML = list.length ? list.map(m => {
    const from = m.from || m.nick;
    return `<div class="agent-row">
      <div><div class="agent-name">${escapeHtml(shortDid(from))}</div><div class="agent-did">${escapeHtml(from)}</div><div class="muted">${escapeHtml(m.text || "")}</div></div>
      <div class="online">● ACTIVE</div>
    </div>`;
  }).join("") : `<div class="empty">No agent records available yet.</div>`;
}

function updateRobot(targetX = 0, targetY = 0) {
  const robot = $("robot");
  const eyes = document.querySelectorAll(".eye");
  const x = Math.max(-9, Math.min(9, targetX));
  const y = Math.max(-7, Math.min(7, targetY));
  robot.style.transform = `translate(${x * .45}px, ${y * .25}px)`;
  eyes.forEach(e => e.style.transform = `translate(${x}px, ${y}px)`);
}

async function loadLobby() {
  try {
    const r = await fetch(`/api/technocore?room=${encodeURIComponent(state.room)}&since=${encodeURIComponent(state.since)}&limit=50&t=${Date.now()}`, {cache:"no-store"});
    const body = await r.json();
    if (!r.ok || !body.ok) throw new Error(body.error || "Telemetry request failed");
    const incoming = normalizeMessages(body.data);
    if (incoming.length) {
      const bySeq = new Map(state.messages.map(m => [String(m.seq), m]));
      incoming.forEach(m => bySeq.set(String(m.seq), m));
      state.messages = [...bySeq.values()].sort((a,b) => Number(a.seq||0)-Number(b.seq||0)).slice(-200);
      state.since = Math.max(state.since, ...incoming.map(m => Number(m.seq)||0));
      renderFeed(); renderStats(); renderAgents();
      $("robotMessage").textContent = "Fresh activity detected.";
    }
    state.connected = true;
    renderStats();
    $("agentState").textContent = "Telemetry live";
  } catch (e) {
    state.connected = false;
    renderStats();
    $("agentState").textContent = "Telemetry unavailable";
    $("robotMessage").textContent = "Telemetry is temporarily unavailable.";
  }
}

async function loadRooms() {
  try {
    const r = await fetch(`/api/technocore-rooms?t=${Date.now()}`, {cache:"no-store"});
    if (!r.ok) throw new Error();
    const body = await r.json();
    const rooms = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    $("roomCount").textContent = rooms.length || "—";
    $("roomsList").innerHTML = rooms.length ? rooms.map(room => `
      <div class="room-row"><div><strong>${escapeHtml(room.name || room.room || "room")}</strong><div class="muted">${escapeHtml(room.topic || "No topic")}</div></div>
      <div class="muted">seq ${escapeHtml(room.last_seq ?? "—")}</div></div>`).join("") : `<div class="empty">Room index unavailable.</div>`;
  } catch {
    $("roomCount").textContent = "—";
    $("roomsList").innerHTML = `<div class="empty">Room index unavailable.</div>`;
  }
}

function setupNav() {
  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => {
    const view = btn.dataset.view;
    document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach(x => x.classList.add("hidden"));
    $(`${view}View`).classList.remove("hidden");
    const titles = {
      dashboard:["Technocore Live Command Center","Real-time public telemetry from the Technocore lobby."],
      agents:["Live Agent Observatory","Writers and signed identities observed in the public lobby window."],
      rooms:["Public Rooms","A lightweight view of rooms exposed by Technocore."],
      identity:["Agent Identity","Inspect your public DID without ever exposing a private key."],
      network:["Network Signal","Public sequence and telemetry health."],
      faucet:["FLOP Testnet Faucet","Official-source monitor. Third-party faucets are ignored."]
    };
    $("viewTitle").textContent = titles[view][0];
    $("viewSubtitle").textContent = titles[view][1];
    $("sidebar").classList.remove("open");
    if (view === "rooms") loadRooms();
  }));
}

document.addEventListener("mousemove", e => {
  updateRobot((e.clientX / innerWidth - .5) * 16, (e.clientY / innerHeight - .5) * 12);
});
document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("mouseenter", () => {
  const map = {dashboard:[-1,0],agents:[-8,-2],rooms:[-8,2],identity:[-7,-6],network:[-8,5],faucet:[-6,1]};
  const p = map[btn.dataset.view] || [0,0];
  updateRobot(...p);
  $("robotMessage").textContent = `Ready for ${btn.querySelector("span").textContent}.`;
}));
document.querySelectorAll(".btn,.nav-item").forEach(btn => btn.addEventListener("mouseleave", () => updateRobot(0,0)));

$("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("refreshBtn").addEventListener("click", () => loadLobby());

$("saveDid").addEventListener("click", () => {
  const did = $("didInput").value.trim();
  if (did) {
    state.did = did;
    localStorage.setItem("flopDid", did);
    renderDid();
    $("robotMessage").textContent = "Identity saved locally.";
  }
});

function renderDid() {
  const did = state.did;
  $("myDid").textContent = did ? shortDid(did) : "did:key: not set";
  $("identityValue").textContent = did || "Not configured";
  $("didInput").value = did;
}
renderDid();
setupNav();
renderFeed();
renderStats();
loadLobby();
loadRooms();
setInterval(loadLobby, 8000);
setInterval(loadRooms, 30000);
