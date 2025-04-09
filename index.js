const { Client, RemoteAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const dotenv = require("dotenv");
const { litellm } = require("litellm");
const admin = require("firebase-admin");

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

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

// LLM configuration (with defaults)
const LLM_CONFIG = {
  provider: process.env.LLM_PROVIDER || "ollama",
  model: process.env.LLM_MODEL || "llama3.2:3b",
  api_base: process.env.LLM_API_BASE || "http://localhost:11434",
  api_key: process.env.LLM_API_KEY || "",
  system_prompt:
    process.env.SYSTEM_PROMPT ||
    "You are a humorous assistant responding to WhatsApp messages. Always respond with a joke that's contextually relevant to the user's message. Try to identify the language the user is writing in and respond in the same language. Keep responses concise and entertaining.",
};

// Function to get response from LLM using LiteLLM
async function getResponseFromLLM(message) {
  try {
    // Set up LiteLLM config based on provider
    const modelString =
      LLM_CONFIG.provider === "ollama"
        ? `ollama/${LLM_CONFIG.model}`
        : LLM_CONFIG.model;

    const options = {
      model: modelString,
      messages: [
        {
          role: "system",
          content: LLM_CONFIG.system_prompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
      api_base: LLM_CONFIG.api_base,
    };

    // Add API key if provided
    if (LLM_CONFIG.api_key) {
      options.api_key = LLM_CONFIG.api_key;
    }

    const response = await litellm.completion(options);

    return response.choices[0].message.content;
  } catch (error) {
    console.error(`Error calling ${LLM_CONFIG.provider} API:`, error.message);
    if (error.response) {
      console.error("API Error:", error.response.data);
    }
    throw new Error("Failed to get response from LLM");
  }
}

// Initialize WhatsApp client
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

// Generate QR code for WhatsApp Web
client.on("qr", (qr) => {
  console.log("QR RECEIVED. Scan with your phone:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp client is ready!");
  console.log(
    `Using LLM provider: ${LLM_CONFIG.provider}, model: ${LLM_CONFIG.model}`
  );
});

client.on("message", async (message) => {
  try {
    // Only respond to messages that aren't from the bot itself
    if (message.fromMe) return;

    // Check if the message has a body (text content)
    if (!message.body || message.hasMedia) {
      const chat = await message.getChat();
      await chat.sendMessage("I can only respond to text messages for now.");
      console.log(
        "Received a media message, informed user about text-only capability"
      );
      return;
    }

    console.log(`Received message: ${message.body}`);

    // Tell user we're processing their message
    const chat = await message.getChat();
    chat.sendStateTyping();

    // Get response from LLM
    const response = await getResponseFromLLM(message.body);

    // Send LLM response - use a direct message rather than reply
    // This avoids issues with quoted messages that might not exist
    await chat.sendMessage(response);

    console.log(`Sent LLM response for: ${message.body}`);
  } catch (error) {
    console.error("Error processing message:", error);
    try {
      // Try to send a direct message instead of a reply
      const chat = await message.getChat();
      await chat.sendMessage(
        "Sorry, I encountered an error. Please try again later."
      );
    } catch (secondError) {
      console.error("Failed to send error message:", secondError);
    }
  }
});

// Start the client
client.initialize();

// Export for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getResponseFromLLM };
}
