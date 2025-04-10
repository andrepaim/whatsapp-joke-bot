const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const dotenv = require('dotenv');
const litellm = require('litellm');

// Load environment variables
dotenv.config();

// LLM configuration (with defaults)
const LLM_CONFIG = {
  provider: process.env.LLM_PROVIDER || 'ollama',
  model: process.env.LLM_MODEL || 'llama3.2:3b',
  api_base: process.env.LLM_API_BASE || 'http://localhost:11434',
  api_key: process.env.LLM_API_KEY || '',
  system_prompt: process.env.SYSTEM_PROMPT || 'You are a humorous assistant responding to WhatsApp messages. Always respond with a joke that\'s contextually relevant to the user\'s message. Try to identify the language the user is writing in and respond in the same language. Keep responses concise and entertaining.'
};

// Function to get response from LLM using LiteLLM
async function getResponseFromLLM(message) {
  try {
    // Set up LiteLLM config based on provider
    const modelString = LLM_CONFIG.provider === 'ollama' 
      ? `ollama/${LLM_CONFIG.model}` 
      : LLM_CONFIG.model;
    
    const options = {
      model: modelString,
      messages: [
        {
          role: 'system',
          content: LLM_CONFIG.system_prompt
        },
        {
          role: 'user',
          content: message
        }
      ],
      api_base: LLM_CONFIG.api_base
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
      console.error('API Error:', error.response.data);
    }
    throw new Error('Failed to get response from LLM');
  }
}

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
});

// Generate QR code for WhatsApp Web
client.on('qr', (qr) => {
  console.log('QR RECEIVED. Scan with your phone:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('WhatsApp client is ready!');
  console.log(`Using LLM provider: ${LLM_CONFIG.provider}, model: ${LLM_CONFIG.model}`);
});

client.on('message', async (message) => {
  try {
    // Only respond to messages that aren't from the bot itself
    if (message.fromMe) return;

    // Check if the message has a body (text content)
    if (!message.body || message.hasMedia) {
      const chat = await message.getChat();
      await chat.sendMessage('I can only respond to text messages for now.');
      console.log('Received a media message, informed user about text-only capability');
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
    console.error('Error processing message:', error);
    try {
      // Try to send a direct message instead of a reply
      const chat = await message.getChat();
      await chat.sendMessage('Sorry, I encountered an error. Please try again later.');
    } catch (secondError) {
      console.error('Failed to send error message:', secondError);
    }
  }
});

// Start the client
client.initialize();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getResponseFromLLM };
}