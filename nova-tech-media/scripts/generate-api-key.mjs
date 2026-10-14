// Usage: npm run generate-key -- <keyId>
// Prints a NEW raw key (give it to the bot owner, never commit it) and the
// "keyId:hash" entry to add to MEDIA_API_KEYS in Vercel.
import crypto from 'node:crypto';

const id = (process.argv[2] || 'bot1').toLowerCase();
if (!/^[a-z0-9_-]{1,32}$/.test(id)) {
  console.error('Key id must be 1-32 chars: a-z, 0-9, _ or -');
  process.exit(1);
}
const raw = 'nova_' + crypto.randomBytes(32).toString('base64url');
const hash = crypto.createHash('sha256').update(raw).digest('hex');
console.log('Raw API key (shown once, store it in the bot\'s environment):\n  ' + raw);
console.log('\nAdd this entry to MEDIA_API_KEYS in Vercel (comma-separate multiple keys):\n  ' + id + ':' + hash);
console.log('\nRotate: add a new entry, update the bot, then remove the old entry and redeploy.');
console.log('Revoke: remove the entry from MEDIA_API_KEYS and redeploy.');
