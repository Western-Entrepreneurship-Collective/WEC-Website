/**
 * Starts the stand-in for Google that the browser tests of the exec
 * applications page submit to. playwright.config.ts points the Next server's
 * WEC_APPLY_GOOGLE_FORM_URL at it, so no test can ever reach a real Form, even
 * with a real link in .env.local (the process environment wins over .env files).
 */
import { E2E_FAKE_PORT, startFakeGoogle } from "./fakeGoogle";

export default async function globalSetup() {
  const google = startFakeGoogle();
  await new Promise<void>((resolve, reject) => {
    google.once("error", reject);
    google.listen(E2E_FAKE_PORT, "127.0.0.1", () => resolve());
  });
  return async () => { await new Promise<void>(resolve => google.close(() => resolve())); };
}
