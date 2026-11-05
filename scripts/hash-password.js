// Dev tool: print the stored form of a password, for pasting into src/seed.js.
//
//   node scripts/hash-password.js 'the password'          (a new random salt)
//   node scripts/hash-password.js 'the password' <salt>   (reuse a base64 salt)
//
// Prints { algo, iterations, salt, hash }. This script never saves the
// password anywhere. Never commit a password to the repository.

import { hashPassword } from '../src/auth/password.js';

const [password, salt] = process.argv.slice(2);
if (!password) {
  console.error("Usage: node scripts/hash-password.js 'password' [base64-salt]");
  process.exit(1);
}
console.log(JSON.stringify(await hashPassword(password, salt ? { salt } : {})));
