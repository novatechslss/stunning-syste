// Example code shown in the docs. Keys come from environment variables, never from source.
export const snippets = (base, token = 'YOUR_API_KEY') => ({
  curl: `curl -X POST ${base}/upload \\
  -H "Authorization: Bearer $NOVA_API_KEY" \\
  -F "file=@photo.jpg"`,
  fetch: `const form = new FormData();
form.append("file", fileInput.files[0]);

const res = await fetch("${base}/upload", {
  method: "POST",
  headers: { Authorization: "Bearer " + API_KEY }, // call from a server, never ship the key to browsers
  body: form
});
const data = await res.json();
console.log(data.id, data.url);`,
  node: `// Node 18+ (global fetch, FormData, Blob)
import { readFile } from "node:fs/promises";

const form = new FormData();
form.append("file", new Blob([await readFile("clip.mp4")], { type: "video/mp4" }), "clip.mp4");

const res = await fetch("${base}/upload", {
  method: "POST",
  headers: { Authorization: "Bearer " + process.env.NOVA_API_KEY },
  body: form
});
if (!res.ok) throw new Error((await res.json()).error.message);
console.log(await res.json());`,
  baileys: `// WhatsApp (Baileys): upload received photos/videos
import { downloadMediaMessage } from "@whiskeysockets/baileys";

const API = "${base}/upload";
const KEY = process.env.NOVA_API_KEY;

sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  const m = msg.message;
  if (!m || msg.key.fromMe) return;
  const media = m.imageMessage || m.videoMessage;
  if (!media) return;

  const buffer = await downloadMediaMessage(msg, "buffer", {});
  const isVideo = Boolean(m.videoMessage);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: media.mimetype }), isVideo ? "video.mp4" : "photo.jpg");

  const res = await fetch(API, { method: "POST", headers: { Authorization: "Bearer " + KEY }, body: form });
  const data = await res.json();
  await sock.sendMessage(msg.key.remoteJid, {
    text: data.success ? "ID: " + data.id + "\\nURL: " + (data.url || "private") : "Upload failed: " + data.error.message
  });
});`,
  telegram: `// Telegram (node-telegram-bot-api)
import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const API = "${base}/upload";

bot.on("photo", async (msg) => {
  const best = msg.photo[msg.photo.length - 1];
  const link = await bot.getFileLink(best.file_id);
  const buffer = Buffer.from(await (await fetch(link)).arrayBuffer());

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "image/jpeg" }), "photo.jpg");
  const res = await fetch(API, { method: "POST", headers: { Authorization: "Bearer " + process.env.NOVA_API_KEY }, body: form });
  const data = await res.json();
  bot.sendMessage(msg.chat.id, data.success ? "ID: " + data.id + "\\nURL: " + (data.url || "private") : "Upload failed: " + data.error.message);
});`,
  response: JSON.stringify(
    {
      success: true,
      id: '0mbq1z7k3a9f0c1d2e3b4a5968778695',
      url: 'https://raw.githubusercontent.com/OWNER/REPO/main/img/2026/10/0mbq1z7k3a9f0c1d2e3b4a5968778695.jpg',
      createdAt: '2026-10-13T09:30:00.000Z',
      mediaType: 'image',
      mimeType: 'image/jpeg',
      sizeBytes: 182345
    },
    null,
    2
  )
});

export const ERRORS = [
  [400, 'NO_FILE / EMPTY_FILE / BAD_MULTIPART', 'No usable file in the "file" field.'],
  [401, 'MISSING_API_KEY / INVALID_API_KEY', 'Authorization header missing or key not recognised.'],
  [403, 'ORIGIN_NOT_ALLOWED / DELETE_DISABLED / LIST_DISABLED', 'Feature off or request not from the website.'],
  [404, 'NOT_FOUND', 'No media with that ID.'],
  [405, 'METHOD_NOT_ALLOWED', 'Wrong HTTP method for this endpoint.'],
  [408, 'UPLOAD_TIMEOUT', 'Upload took too long.'],
  [413, 'FILE_TOO_LARGE', 'File above the configured size limit.'],
  [415, 'INVALID_SIGNATURE / FORMAT_NOT_ALLOWED / EXTENSION_MISMATCH / MIME_MISMATCH', 'File type rejected.'],
  [429, 'RATE_LIMITED', 'Too many requests. Honour the Retry-After header.'],
  [502, 'GITHUB_ERROR / STORAGE_MISCONFIGURED / METADATA_FAILED', 'Storage backend problem. Nothing is reported as saved unless GitHub confirmed it.'],
  [503, 'UPLOADS_DISABLED / NOT_CONFIGURED / GITHUB_RATE_LIMITED', 'Temporarily unavailable.'],
  [504, 'GITHUB_UNREACHABLE', 'Storage did not answer in time.']
];
