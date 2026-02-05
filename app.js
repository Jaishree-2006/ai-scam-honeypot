const apiOutput = document.getElementById("api-output");
const convoFeed = document.getElementById("conversation-feed");
const entityList = document.getElementById("entity-list");
const detectionRate = document.getElementById("detection-rate");
const totalMessages = document.getElementById("total-messages");
const scamsDetected = document.getElementById("scams-detected");
const accuracyRate = document.getElementById("accuracy-rate");
const avgEngagement = document.getElementById("avg-engagement");
const topScam = document.getElementById("top-scam");
const recentActivity = document.getElementById("recent-activity");
const chartBars = document.getElementById("chart-bars");

let apiKey = "";

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const cfg = await res.json();
      apiKey = cfg.apiKey || "";
    }
  } catch {
    apiKey = "";
  }
}

const apiHeaders = () => (apiKey ? { "x-api-key": apiKey } : {});

async function loadLatest() {
  if (!apiOutput) return;
  const res = await fetch("/api/scan", { headers: apiHeaders() });
  const data = await res.json();
  apiOutput.textContent = JSON.stringify(data, null, 2);
  renderEntities(data.entities);
}

async function loadAnalytics() {
  if (!detectionRate || !totalMessages || !chartBars) return;
  const res = await fetch("/api/analytics", { headers: apiHeaders() });
  const data = await res.json();
  const percent = `${Math.round(data.detectionRate * 100)}%`;
  detectionRate.textContent = percent;
  totalMessages.textContent = data.totalMessages;
  if (scamsDetected) scamsDetected.textContent = data.scamsDetected;
  if (accuracyRate) accuracyRate.textContent = percent;
  if (topScam) topScam.textContent = getTopCategory(data.categories);
  renderChart(data.categories);
}

async function loadConversations() {
  if (!convoFeed && !recentActivity && !avgEngagement) return;
  const res = await fetch("/api/conversations", { headers: apiHeaders() });
  const data = await res.json();
  if (convoFeed) {
    convoFeed.innerHTML = data
      .map((item) => {
        const first = item.conversation?.[0]?.text || "";
        const second = item.conversation?.[1]?.text || "";
        return `
          <div class="msg">Scammer: ${first}</div>
          <div class="msg bot">Agent: ${second}</div>
        `;
      })
      .join("");
  }

  if (avgEngagement) {
    if (!data.length) {
      avgEngagement.textContent = "—";
    } else {
      const avg = Math.round(
        data.reduce((sum, item) => {
          const text = item.conversation?.[0]?.text || "";
          return sum + text.split(/\s+/).filter(Boolean).length;
        }, 0) / data.length
      );
      avgEngagement.textContent = `${avg} words`;
    }
  }

  renderRecentActivity(data.slice(0, 3));
}

function formatCategory(category) {
  const map = {
    kyc: "KYC Fraud",
    phishing: "Phishing",
    loan: "Loan Scam",
    upi: "UPI Fraud",
    bank: "Bank Details Scam"
  };
  return map[category] || "Unknown";
}

function getTopCategory(categories = {}) {
  const entries = Object.entries(categories);
  if (!entries.length) return "—";
  const [label, value] = entries.reduce(
    (top, current) => (current[1] > top[1] ? current : top),
    ["", 0]
  );
  if (!value) return "—";
  return formatCategory(label);
}

function renderEntities(entities) {
  if (!entities || !entityList) return;
  entityList.innerHTML = "";
  const entries = [
    ["UPI", entities.upiIds],
    ["Bank Accounts", entities.bankAccounts],
    ["IFSC", entities.ifscCodes],
    ["Phones", entities.phoneNumbers],
    ["Phishing Links", entities.phishingLinks]
  ];
  entries.forEach(([label, values]) => {
    const li = document.createElement("li");
    li.textContent = `${label}: ${values.length ? values.join(", ") : "—"}`;
    entityList.appendChild(li);
  });
}

function renderChart(categories) {
  if (!chartBars) return;
  chartBars.innerHTML = "";
  const max = Math.max(...Object.values(categories), 1);
  Object.entries(categories).forEach(([label, value]) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.innerHTML = `
      <div class="bar-top">
        <div class="bar-fill" style="height:${(value / max) * 100}%"></div>
      </div>
      <span>${label}</span>
      <strong>${value}</strong>
    `;
    chartBars.appendChild(bar);
  });
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "—";
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

function renderRecentActivity(items) {
  if (!recentActivity) return;
  if (!items.length) {
    recentActivity.innerHTML = `<div class="activity-item"><div class="activity-meta"><div class="activity-icon">⏳</div><div><div class="activity-text">No activity yet</div><div class="activity-time">Waiting for messages</div></div></div></div>`;
    return;
  }

  recentActivity.innerHTML = items
    .map((item) => {
      const label = item.scamDetected ? formatCategory(item.category) : "No Scam";
      const icon = item.scamDetected ? "⚠️" : "✅";
      const time = formatTimeAgo(item.timestamp);
      return `
        <div class="activity-item">
          <div class="activity-meta">
            <div class="activity-icon">${icon}</div>
            <div>
              <div class="activity-text">${label}</div>
              <div class="activity-time">${time}</div>
            </div>
          </div>
          <div class="activity-time">${item.scamDetected ? "Fraud" : "Clear"}</div>
        </div>
      `;
    })
    .join("");
}

const form = document.getElementById("sim-form");
const input = document.getElementById("sim-input");
const simLog = document.getElementById("sim-log");

if (form && input && simLog) {
  form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  simLog.innerHTML = `<div class="msg">Scammer: ${message}</div>` + simLog.innerHTML;

  const res = await fetch("/api/mock-scammer", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...apiHeaders() },
    body: JSON.stringify({ message })
  });
  const data = await res.json();
  simLog.innerHTML = `<div class="msg bot">Agent: ${data.reply}</div>` + simLog.innerHTML;

  apiOutput.textContent = JSON.stringify(data.output, null, 2);
  renderEntities(data.output.entities);
  await loadAnalytics();
  await loadConversations();

    input.value = "";
  });
}

await loadConfig();
loadLatest();
loadAnalytics();
loadConversations();

const navToggle = document.getElementById("nav-toggle");
const mobileMenu = document.getElementById("mobile-menu");
const menuBackdrop = document.getElementById("menu-backdrop");

function openMenu() {
  document.body.classList.add("menu-open");
  navToggle?.setAttribute("aria-expanded", "true");
  mobileMenu?.setAttribute("aria-hidden", "false");
  menuBackdrop?.setAttribute("aria-hidden", "false");
}

function closeMenu() {
  document.body.classList.remove("menu-open");
  navToggle?.setAttribute("aria-expanded", "false");
  mobileMenu?.setAttribute("aria-hidden", "true");
  menuBackdrop?.setAttribute("aria-hidden", "true");
}

if (navToggle && mobileMenu && menuBackdrop) {
  navToggle.addEventListener("click", () => {
    if (document.body.classList.contains("menu-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  menuBackdrop.addEventListener("click", closeMenu);

  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

const matrixCanvas = document.getElementById("matrix-canvas");
if (matrixCanvas) {
  const ctx = matrixCanvas.getContext("2d");
  const fontSize = 16;
  let columns = 0;
  let rows = 0;
  let chars = [];
  let highlights = [];
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const resizeMatrix = () => {
    matrixCanvas.width = window.innerWidth;
    matrixCanvas.height = window.innerHeight;
    columns = Math.floor(matrixCanvas.width / fontSize);
    rows = Math.floor(matrixCanvas.height / fontSize);
    chars = Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => glyphs[Math.floor(Math.random() * glyphs.length)])
    );
    highlights = Array.from({ length: columns }, () => ({
      row: Math.floor(Math.random() * rows),
      speed: 0.35 + Math.random() * 0.6,
      intensity: 0.7 + Math.random() * 0.3
    }));
  };

  resizeMatrix();
  window.addEventListener("resize", resizeMatrix);

  const drawMatrix = () => {
    ctx.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    ctx.font = `${fontSize}px "Inter", "Segoe UI", Arial, sans-serif`;
    ctx.textBaseline = "top";

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const highlight = highlights[x];
        const distance = Math.abs(highlight.row - y);
        const glow = Math.max(0, 1 - distance / 6) * highlight.intensity;
        const base = 0.08;
        const alpha = base + glow * 0.7;
        const green = Math.round(120 + glow * 135);
        ctx.fillStyle = `rgba(30, ${green}, 90, ${alpha})`;
        ctx.fillText(chars[y][x], x * fontSize, y * fontSize);
      }
    }

    highlights.forEach((h, index) => {
      h.row += h.speed;
      if (h.row >= rows) {
        h.row = 0;
        h.speed = 0.35 + Math.random() * 0.6;
        h.intensity = 0.7 + Math.random() * 0.3;
      }
      if (Math.random() < 0.01) {
        const randomRow = Math.floor(Math.random() * rows);
        chars[randomRow][index] = glyphs[Math.floor(Math.random() * glyphs.length)];
      }
    });

    requestAnimationFrame(drawMatrix);
  };

  drawMatrix();
}

const graphCanvas = document.getElementById("graph-canvas");
if (graphCanvas) {
  const gctx = graphCanvas.getContext("2d");
  const pointCount = 64;
  let graphWidth = 0;
  let graphHeight = 0;
  let points = [];
  let xSpacing = 0;

  const initGraph = () => {
    graphCanvas.width = graphCanvas.offsetWidth * window.devicePixelRatio;
    graphCanvas.height = graphCanvas.offsetHeight * window.devicePixelRatio;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    graphWidth = graphCanvas.offsetWidth;
    graphHeight = graphCanvas.offsetHeight;
    xSpacing = graphWidth / (pointCount - 1);
    let y = graphHeight * 0.72;
    points = Array.from({ length: pointCount }, (_, i) => {
      const x = xSpacing * i;
      const heartbeat = i % 7 === 0;
      const spike = heartbeat ? (Math.random() * 0.12 + 0.06) : (Math.random() * 0.05 + 0.02);
      const direction = Math.random() > 0.52 ? 1 : -1;
      y += direction * spike * graphHeight;
      y += Math.sin(i * 0.9) * graphHeight * 0.02;
      y = Math.max(graphHeight * 0.12, Math.min(graphHeight * 0.9, y));
      return { x, y };
    });
  };

  initGraph();
  window.addEventListener("resize", initGraph);

  const drawGraph = () => {
    gctx.clearRect(0, 0, graphWidth, graphHeight);

    const gridSize = 26;
    gctx.lineWidth = 1;
    gctx.strokeStyle = "rgba(61, 255, 138, 0.08)";
    gctx.shadowBlur = 0;
    for (let x = 0; x <= graphWidth; x += gridSize) {
      gctx.beginPath();
      gctx.moveTo(x, 0);
      gctx.lineTo(x, graphHeight);
      gctx.stroke();
    }
    for (let y = 0; y <= graphHeight; y += gridSize) {
      gctx.beginPath();
      gctx.moveTo(0, y);
      gctx.lineTo(graphWidth, y);
      gctx.stroke();
    }

    const scrollSpeed = 0.9;
    points.forEach((p) => {
      p.x -= scrollSpeed;
    });
    if (points[0].x <= -xSpacing) {
      points.shift();
      const last = points[points.length - 1];
      const pulse = Math.random() < 0.28;
      const amplitude = pulse
        ? graphHeight * (0.08 + Math.random() * 0.08)
        : graphHeight * (0.03 + Math.random() * 0.04);
      const direction = Math.random() > 0.5 ? -1 : 1;
      let y = last.y + direction * amplitude;
      y += (Math.random() * 0.04 - 0.02) * graphHeight;
      y = Math.max(graphHeight * 0.12, Math.min(graphHeight * 0.9, y));
      points.push({ x: last.x + xSpacing, y });
    }

    gctx.lineWidth = 2.4;
    gctx.strokeStyle = "rgba(61, 255, 138, 0.98)";
    gctx.shadowColor = "rgba(61, 255, 138, 0.9)";
    gctx.shadowBlur = 30;

    gctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) gctx.moveTo(p.x, p.y);
      else gctx.lineTo(p.x, p.y);
    });
    gctx.stroke();

    gctx.shadowBlur = 42;
    gctx.strokeStyle = "rgba(61, 255, 138, 0.35)";
    gctx.lineWidth = 7;
    gctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) gctx.moveTo(p.x, p.y);
      else gctx.lineTo(p.x, p.y);
    });
    gctx.stroke();

    gctx.shadowBlur = 12;
    gctx.strokeStyle = "rgba(61, 255, 138, 0.45)";
    gctx.lineWidth = 1.4;
    gctx.beginPath();
    points.forEach((p, i) => {
      const lift = graphHeight * 0.08;
      if (i === 0) gctx.moveTo(p.x, p.y - lift);
      else gctx.lineTo(p.x, p.y - lift);
    });
    gctx.stroke();

    gctx.shadowBlur = 10;
    gctx.fillStyle = "rgba(61, 255, 138, 0.8)";
    points.forEach((p, i) => {
      if (i % 6 === 0) {
        gctx.beginPath();
        gctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        gctx.fill();
        gctx.beginPath();
        gctx.arc(p.x, p.y - graphHeight * 0.08, 1.6, 0, Math.PI * 2);
        gctx.fill();
      }
    });

    requestAnimationFrame(drawGraph);
  };

  drawGraph();
}
