/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { Client, RemoteAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const dotenv = require("dotenv");
const { litellm } = require("litellm");

dotenv.config();

// Initialize Firebase Admin SDK
admin.initializeApp();
const bucket = admin.storage().bucket();

// Firebase storage adapter for RemoteAuth
class FirebaseStorageAdapter {
  constructor(bucket) {
    this.bucket = bucket;
  }

  async set(key, value) {
    const file = this.bucket.file(key);
    await file.save(JSON.stringify(value));
  }

  async get(key) {
    const file = this.bucket.file(key);
    try {
      const [data] = await file.download();
      return JSON.parse(data.toString());
    } catch (error) {
      if (error.code === 404) return null; // File not found
      throw error;
    }
  }

  async delete(key) {
    const file = this.bucket.file(key);
    await file.delete({ ignoreNotFound: true });
  }

  async getAll() {
    const [files] = await this.bucket.getFiles();
    const sessions = [];
    for (const file of files) {
      const key = file.name;
      const [data] = await file.download();
      sessions.push({ key, data: JSON.parse(data.toString()) });
    }
    return sessions;
  }
  
  // Required for RemoteAuth
  async sessionExists(options) {
    const { session } = options;
    try {
      const file = this.bucket.file(session);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      console.error('Error checking if session exists:', error);
      return false;
    }
  }
}

const firebaseStorage = new FirebaseStorageAdapter(bucket);

const client = new Client({
  authStrategy: new RemoteAuth({
    clientId: "whatsapp-bot",
    store: firebaseStorage,
    backupSyncIntervalMs: 300000 // 5 minutes
  }),
  puppeteer: {
    browserWSEndpoint: process.env.PUPPETEER_WS_ENDPOINT,
  },
});

client.on("qr", (qr) => {
  console.log("QR RECEIVED. Scan with your phone:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp client is ready!");
});

client.on("message", async (message) => {
  try {
    if (message.fromMe) return;

    if (!message.body || message.hasMedia) {
      const chat = await message.getChat();
      await chat.sendMessage("I can only respond to text messages for now.");
      return;
    }

    const chat = await message.getChat();
    chat.sendStateTyping();

    const response = await litellm.completion({
      model: "ollama/llama3.2:3b",
      messages: [
        { role: "system", content: "You are a humorous assistant." },
        { role: "user", content: message.body },
      ],
    });

    await chat.sendMessage(response.choices[0].message.content);
  } catch (error) {
    console.error("Error processing message:", error);
  }
});

client.initialize();

exports.whatsappBot = onRequest((req, res) => {
  res.send("WhatsApp bot is running!");
});
