import "dotenv/config";
import { supabase } from "./supabaseClient.js";

const run = async () => {
  const { data, error } = await supabase
    .from("scam_messages")
    .insert([
      {
        message_text: "Test message",
        is_scam: false,
        confidence_score: 0.1,
        language: "English"
      }
    ]);

  if (error) {
    console.error("Insert failed:", error);
    return;
  }
  console.log("Insert success:", data);
};

run();
