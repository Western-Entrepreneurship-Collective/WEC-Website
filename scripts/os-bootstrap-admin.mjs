#!/usr/bin/env node
/**
 * Creates the first WEC OS administrator and sends their invitation. It takes real
 * names on the command line because this repository is public and they cannot live
 * in a migration. It refuses to run once any administrator exists.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WEC_OS_SITE_URL=... \
 *     node scripts/os-bootstrap-admin.mjs you@example.ca "Your Name" "President"
 *
 * The position title is optional, and must match one in the database exactly.
 */
import { createClient } from "@supabase/supabase-js";

const [email, fullName, positionTitle] = process.argv.slice(2);
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, WEC_OS_SITE_URL: site } = process.env;

if (!email || !fullName) {
  console.error('Usage: node scripts/os-bootstrap-admin.mjs <email> "<full name>" ["<position title>"]');
  process.exit(1);
}
if (!url || !key || !site) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and WEC_OS_SITE_URL.");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: rpcError } = await client.schema("api").rpc("bootstrap_first_admin", {
  p_email: email, p_full_name: fullName, p_position_title: positionTitle ?? null,
});
if (rpcError) {
  console.error(`Refused: ${rpcError.message}`);
  process.exit(1);
}
const { error: inviteError } = await client.auth.admin.inviteUserByEmail(email.toLowerCase(), { redirectTo: `${site.replace(/\/$/, "")}/os/activate` });
if (inviteError) {
  console.error(`Saved, but the email did not send: ${inviteError.message}. Check the mail settings, and run this again.`);
  process.exit(1);
}
console.log(`Invitation sent to ${email}.`);
