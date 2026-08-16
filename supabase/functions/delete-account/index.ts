// Deletes the CALLING user's own account. Actually removing an auth.users
// row requires the service-role key (the admin API), which must never be
// shipped to the client -- so this has to run server-side. Who gets deleted
// is always derived from the caller's own verified JWT, never from a
// client-supplied id, so there's no way to delete someone else's account
// through this endpoint.
//
// Deleting auth.users cascades to profiles (on delete cascade), which
// cascades to accounts, transactions, and household_members (all on delete
// cascade from profiles) -- see supabase/migrations/0001_init.sql and
// 0007_account_deletion.sql for the invites fix that made this possible.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { ...corsHeaders, ...init?.headers },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return json({ error: "Not authenticated" }, { status: 401 });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: (err as Error).message }, { status: 500 });
  }
});
