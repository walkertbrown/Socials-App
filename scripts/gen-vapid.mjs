// Generate VAPID keys for web push. Run once: node scripts/gen-vapid.mjs
// Paste the printed lines into .env.local (the public key is also exposed to the
// browser via NEXT_PUBLIC_VAPID_PUBLIC_KEY).
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("\nAdd these to .env.local:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:walkertbrown@gmail.com`);
console.log("");
