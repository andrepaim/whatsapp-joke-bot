# WhatsApp Joke Bot

A WhatsApp bot that responds to every message with a contextual joke using LiteLLM for broad LLM integration. By default, it connects to Ollama running locally, but can be configured to use other providers. It always tries to match the user's language.

## Requirements

- Node.js v16 or higher
- WhatsApp account
- Default: [Ollama](https://ollama.ai/) running locally
- Alternative: Any LLM provider supported by LiteLLM

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. For the default setup with Ollama locally, make sure Ollama is running and has the required model:
   ```
   ollama pull llama3.2:3b
   ```

3. Configure the bot (optional):
   Create a `.env` file with your configuration (defaults are provided if not specified):
   ```
   # LLM Provider (defaults to 'ollama')
   LLM_PROVIDER=ollama
   
   # Model name (provider-specific)
   LLM_MODEL=llama3.2:3b
   
   # Base URL for the API (defaults to Ollama's local URL)
   LLM_API_BASE=http://localhost:11434
   
   # API key (if needed for your provider)
   LLM_API_KEY=
   
   # System prompt for the LLM
   SYSTEM_PROMPT=You are a humorous assistant responding to WhatsApp messages. Always respond with a joke that's contextually relevant to the user's message. Try to identify the language the user is writing in and respond in the same language. Keep responses concise and entertaining.
   ```

4. Start the bot:
   ```
   npm start
   ```

5. Scan the QR code with your WhatsApp mobile app:
   - Open WhatsApp on your phone
   - Tap Menu or Settings and select "Linked Devices"
   - Tap "Link a Device"
   - Point your phone at the QR code displayed in the terminal

## Usage

- Send any text message to the bot, and it will reply with a contextual joke related to your message
- The bot automatically detects and responds in the same language you're using
- The bot will show a "typing" indicator while crafting the perfect joke

## Configuration

You can customize the bot by setting these environment variables in your `.env` file:

- `LLM_PROVIDER`: The LLM provider to use (default: ollama)
- `LLM_MODEL`: The model to use (default: llama3.2:3b)
- `LLM_API_BASE`: Base URL for the API (default: http://localhost:11434)
- `LLM_API_KEY`: API key for providers that require authentication
- `SYSTEM_PROMPT`: System prompt to guide the LLM's responses

## Using with Different LLM Providers

Thanks to LiteLLM integration, this bot supports a wide range of LLM providers beyond Ollama:

### OpenAI Example
```
LLM_PROVIDER=openai
LLM_MODEL=gpt-3.5-turbo
LLM_API_BASE=https://api.openai.com/v1
LLM_API_KEY=your-openai-api-key
```

### Azure OpenAI Example
```
LLM_PROVIDER=azure
LLM_MODEL=gpt-4
LLM_API_BASE=https://your-resource.openai.azure.com
LLM_API_KEY=your-azure-api-key
```

### Anthropic Example
```
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku
LLM_API_KEY=your-anthropic-api-key
```

For a complete list of supported providers, visit the [LiteLLM documentation](https://docs.litellm.ai/docs/providers).

## Cloud Deployment (Firebase)

This bot can be deployed to Firebase using the Firebase Functions implementation in this repository:

### Prerequisites

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Create a Firebase project:
   - Go to the [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Firebase Storage
   - Enable Firebase Functions

### Configuration

1. Authenticate with Firebase:
   ```bash
   firebase login
   ```

2. Initialize Firebase in your project (if not already done):
   ```bash
   firebase init
   ```

3. Remote Browser Setup:
   - You need a remote Chrome instance with a WebSocket endpoint
   - Options include:
     - [browserless.io](https://browserless.io/)
     - A self-hosted browser service with Puppeteer
     - Google Cloud Run instance with Chrome and WebSocket server

4. Set environment variables:
   ```bash
   firebase functions:config:set whatsapp.browser_ws_endpoint="ws://your-browser-service:3000"
   firebase functions:config:set firebase.storage_bucket="your-firebase-bucket-name"
   ```

### Deployment

Deploy to Firebase:
```bash
firebase deploy
```

Once deployed, the bot will run on Firebase Functions and use Firebase Storage to persist WhatsApp authentication data. The first time you run it, you'll need to scan the QR code as usual, but for subsequent deployments, the authentication will be reused.

## Automated Testing

### Firebase Emulator Tests

The project includes GitHub Actions workflows to test the Firebase integration:

1. **Firebase Integration Test (`firebase-test.yml`)**: 
   - Runs unit tests against the codebase
   - Sets up Firebase emulators for Storage and Functions
   - Tests the Firebase Storage adapter functionality
   - Can be manually triggered to deploy to a test environment

2. **WhatsApp Integration Test (`integration-test.yml`)**:
   - Manual workflow that tests end-to-end functionality
   - Requires:
     - Remote browser endpoint (WebSocket URL)
     - Firebase storage bucket name
     - WhatsApp number to send test messages to
   - Validates that:
     - RemoteAuth successfully authenticates without QR code
     - Bot can send and receive messages
     - Response from LLM is received

### Running Firebase Tests Locally

To test Firebase functionality locally:

1. Install Firebase Emulator:
   ```bash
   npm install -g firebase-tools
   ```

2. Start emulators:
   ```bash
   firebase emulators:start --only functions,storage
   ```

3. Run tests with emulator configuration:
   ```bash
   FIREBASE_STORAGE_EMULATOR_HOST="localhost:9199" npm test
   ```

## Notes

This bot uses:
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) for WhatsApp integration
- [LiteLLM](https://github.com/BerriAI/litellm) for LLM integration
- [Ollama](https://ollama.ai/) as the default LLM provider
- [Firebase](https://firebase.google.com/) for cloud deployment and authentication storage