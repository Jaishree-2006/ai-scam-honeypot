import { supabase } from './supabaseClient.js'

async function insertTestMessage() {
  const { data, error } = await supabase
    .from('scam_messages')
    .insert([
      {
        message_text: "You have won a prize. Click link now!",
        is_scam: true,
        confidence_score: 0.92,
        language: "English"
      }
    ])

  if (error) {
    console.error("❌ Error inserting:", error)
  } else {
    console.log("✅ Inserted successfully:", data)
  }
}

insertTestMessage()
