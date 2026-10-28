/**
 * The first administrator: npm run user:admin -- <e-mail> [name]
 * Prints a temporary password once (the database keeps only its hash); change it after signing in.
 */
import { ensureAdmin, newPassword } from "@/lib/auth";
import { closePool } from "@/lib/db";

const [email, name = ""] = process.argv.slice(2);
if (!email) {
  console.error("usage: npm run user:admin -- <e-mail> [name]");
  process.exit(2);
}
async function main(): Promise<void> {
  const password = newPassword();
  await ensureAdmin(email!, password, name);
  console.log(`administrator ${email!.toLowerCase()}\ntemporary password: ${password}`);
  await closePool();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
