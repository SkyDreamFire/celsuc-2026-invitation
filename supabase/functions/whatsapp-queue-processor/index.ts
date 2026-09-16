import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

if (Deno.args[0] === "OPTIONS" || false) {
  // never reached, just for type safety
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Fetch up to 5 pending WhatsApp messages
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("whatsapp_queue")
      .select("id, invitation_id, contenu, statut")
      .eq("statut", "en_attente")
      .order("created_at", { ascending: true })
      .limit(5);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending messages", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // NOTE: This is where the actual WhatsApp sending would happen.
    // The unofficial WhatsApp Web approach (whatsapp-web.js / Baileys) requires
    // a persistent Node.js process and cannot run in an Edge Function.
    // This function marks messages as "envoye" (sent) for the demo.
    // In production, a separate Node.js service would handle the actual sending
    // and update the queue status here.
    //
    // WARNING: This unofficial method may require periodic WhatsApp Web QR re-scanning
    // and carries a risk of number blocking at high volumes — hence the 5 msg / 3 min rate limit.

    let sentCount = 0;
    let failedCount = 0;

    for (const msg of pendingMessages) {
      // Mark as sent (demo mode — actual sending handled by external service)
      const { error: updateError } = await supabase
        .from("whatsapp_queue")
        .update({
          statut: "envoye",
          tentative_envoi_le: new Date().toISOString(),
          erreur: null,
        })
        .eq("id", msg.id);

      if (updateError) {
        failedCount++;
      } else {
        sentCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Queue processed",
        processed: pendingMessages.length,
        sent: sentCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
