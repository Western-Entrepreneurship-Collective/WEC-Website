/**
 * The Supabase CLI's published local demo keys. They only ever open a stack on this
 * machine, which is why they can sit in a public repository. Every test goes through
 * assertLocal, so nothing here can reach a hosted project by accident, whatever is
 * in .env.local.
 */
export const LOCAL = {
  url: "http://127.0.0.1:54321",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  serviceKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU",
  mail: "http://127.0.0.1:54324",
  password: "local-test-password",
};

export function assertLocal(url: string) {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error(`Refusing to run WEC OS tests against ${host}`);
}
