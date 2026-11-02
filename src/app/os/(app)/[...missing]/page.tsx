import { notFound } from "next/navigation";

// Anything unknown under /os: signed in, it gets the 404 inside the workspace; signed
// out, the layout above sends it to sign-in, so the address reveals nothing either way.
export default function MissingPage() {
  notFound();
}
