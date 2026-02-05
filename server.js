import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/config", (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    apiKey: process.env.API_KEY || ""
  });
});

const API_KEY = process.env.API_KEY;
const requireApiKey = (req, res, next) => {
  if (!API_KEY) return next();
  if (req.method === "OPTIONS") return next();
  const key = req.header("x-api-key");
  if (key && key === API_KEY) return next();
  return res.status(401).json({ error: "Unauthorized" });
};

app.use("/api", requireApiKey);
app.use("/detect-scam", requireApiKey);

const analytics = {
  totalMessages: 0,
  scamsDetected: 0,
  categories: {
    phishing: 0,
    loan: 0,
    kyc: 0,
    upi: 0,
    bank: 0
  },
  latest: null
};

const conversationLog = [];

const scamKeywords = [
  "verify", "kyc", "account", "urgent", "otp", "click", "link", "bank",
  "upi", "loan", "refund", "blocked", "suspended", "payment"
];

const patterns = {
  upi: /[\w.-]+@[\w.-]+/g,
  ifsc: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
  account: /\b\d{9,18}\b/g,
  phone: /\b\d{10}\b/g,
  link: /https?:\/\/[^\s]+/g
};

function classify(text) {
  const lower = text.toLowerCase();
  const hits = scamKeywords.filter((k) => lower.includes(k)).length;
  const confidence = Math.min(0.3 + hits * 0.1, 0.95);
  return {
    scamDetected: hits >= 2,
    confidence: Number(confidence.toFixed(2))
  };
}

function categorize(text) {
  const lower = text.toLowerCase();
  if (lower.includes("loan")) return "loan";
  if (lower.includes("kyc")) return "kyc";
  if (lower.includes("upi")) return "upi";
  if (lower.includes("bank") || lower.includes("ifsc")) return "bank";
  return "phishing";
}

function extractEntities(text) {
  return {
    upiIds: text.match(patterns.upi) || [],
    bankAccounts: text.match(patterns.account) || [],
    ifscCodes: text.match(patterns.ifsc) || [],
    phoneNumbers: text.match(patterns.phone) || [],
    phishingLinks: text.match(patterns.link) || []
  };
}

function updateAnalytics(classification, category) {
  analytics.totalMessages += 1;
  if (classification.scamDetected) {
    analytics.scamsDetected += 1;
    analytics.categories[category] = (analytics.categories[category] || 0) + 1;
  }
}

async function persistToSupabase(message, isScam, confidence, language = "English") {
  try {
    if (!supabase) return;
    const { error } = await supabase
      .from("scam_messages")
      .insert([
        {
          message_text: message,
          is_scam: isScam,
          confidence_score: confidence,
          language
        }
      ]);
    if (error) console.error(error);
  } catch (err) {
    console.error(err);
  }
}

function buildResponse(userMessage) {
  const classification = classify(userMessage);
  const category = categorize(userMessage);
  const entities = extractEntities(userMessage);

  const agentReply = classification.scamDetected
    ? "I can help. Please share your UPI ID, bank account, and IFSC for verification."
    : "Thanks for the message. Can you clarify the issue?";

  const record = {
    scamDetected: classification.scamDetected,
    confidence: classification.confidence,
    category,
    entities,
    conversation: [
      { role: "scammer", text: userMessage },
      { role: "agent", text: agentReply }
    ],
    timestamp: new Date().toISOString()
  };

  updateAnalytics(classification, category);
  analytics.latest = record;
  conversationLog.unshift(record);

  return { record, agentReply };
}

app.get("/api/scan", (req, res) => {
  if (analytics.latest) return res.json(analytics.latest);
  return res.json({
    scamDetected: false,
    confidence: 0,
    category: "unknown",
    entities: {
      upiIds: [],
      bankAccounts: [],
      ifscCodes: [],
      phoneNumbers: [],
      phishingLinks: []
    },
    conversation: [],
    timestamp: new Date().toISOString()
  });
});

app.get("/api/analytics", (req, res) => {
  res.json({
    totalMessages: analytics.totalMessages,
    scamsDetected: analytics.scamsDetected,
    categories: analytics.categories,
    detectionRate: analytics.totalMessages
      ? Number((analytics.scamsDetected / analytics.totalMessages).toFixed(2))
      : 0
  });
});

app.get("/api/conversations", (req, res) => {
  res.json(conversationLog.slice(0, 20));
});

app.post("/api/mock-scammer", (req, res) => {
  const userMessage = req.body?.message || "";
  const { record, agentReply } = buildResponse(userMessage);
  res.json({ reply: agentReply, output: record });
});

app.post("/detect-scam", async (req, res) => {
  try {
    const { message, language = "English" } = req.body || {};
    if (!message) return res.status(400).json({ error: "Message is required" });

    const classification = classify(message);
    const isScam = classification.scamDetected;
    const confidence = classification.confidence;

    await persistToSupabase(message, isScam, confidence, language);

    res.json({
      is_scam: isScam,
      confidence_score: confidence,
      explanation: isScam
        ? "Message contains scam-related keywords"
        : "No scam patterns detected"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
