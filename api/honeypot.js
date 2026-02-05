export default function handler(req, res) {
  res.status(200).json({
    status: "success",
    honeypot: "active",
    message: "AI Scam Honeypot endpoint is live"
  });
}
