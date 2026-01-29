# Internal Client Application

A sophisticated client management system that combines AI-powered document analysis with intelligent chat capabilities.

## Features

### 🗂️ Document Asset Management
- **Client-based organization**: Organize documents by client with custom thumbnails and descriptions
- **Multi-format support**: PDF, DOCX, TXT, XLSX, CSV, PNG, JPG
- **Drag-and-drop upload**: Easy file uploads with progress tracking
- **Automatic processing**: Background AI analysis of uploaded documents

### 🤖 AI-Powered Analysis
- **Automatic summarization**: Generate comprehensive summaries (200-500 words)
- **Smart tagging**: Extract 5-10 relevant tags per document
- **Keyword extraction**: Identify 10-15 important keywords
- **Topic classification**: Categorize documents by topic
- **Sentiment analysis**: Analyze sentiment (positive/negative/neutral) with scoring
- **Title generation**: Create descriptive titles for documents

### 💬 RAG Chat Interface
- **Context-aware chat**: AI assistant with access to your document library
- **Semantic search**: Find relevant documents based on meaning
- **Source citation**: See which documents were used to answer questions
- **Conversation history**: Maintain chat context across sessions

### 🔒 Enterprise-Ready
- **Scalable architecture**: Built for growth with modern tech stack
- **Vector search**: Fast semantic search using pgvector
- **Real-time processing**: Async document processing pipeline
- **Free tier compatible**: Designed to run on free Supabase tier

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **TanStack Query** - Data fetching
- **React Router** - Navigation
- **React Dropzone** - File uploads
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express** - API framework
- **Claude AI (Anthropic)** - Document analysis & chat
- **Multer** - File upload handling
- **pdf-parse** - PDF text extraction
- **mammoth** - DOCX text extraction
- **xlsx** - Spreadsheet parsing

### Database & Storage
- **Supabase** (Free tier)
  - PostgreSQL database
  - pgvector for semantic search
  - Storage buckets for files
  - Real-time subscriptions

## Project Structure

```
internal-client-app/
├── backend/
│   ├── config/
│   │   └── supabase.js          # Database connection
│   ├── routes/
│   │   ├── clients.js           # Client CRUD operations
│   │   ├── documents.js         # Document upload & processing
│   │   └── chat.js              # Chat with RAG
│   ├── services/
│   │   ├── claudeService.js     # AI analysis & chat
│   │   └── fileProcessor.js     # File text extraction
│   ├── server.js                # Express server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                 # API client functions
│   │   ├── components/          # React components
│   │   ├── pages/               # Page components
│   │   ├── App.jsx              # Main app component
│   │   └── main.jsx             # Entry point
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── ARCHITECTURE.md          # System architecture
│   └── DATABASE_SETUP.sql       # Database schema
└── README.md                    # This file
```

## Getting Started

### Prerequisites

- **Node.js** 18+ installed
- **Supabase account** (free tier)
- **Anthropic API key** (Claude API)

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd internal-client-app
```

### Step 2: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to finish provisioning
3. Go to **Project Settings > API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` key (keep this secret!)
4. Go to **SQL Editor** and run the contents of `docs/DATABASE_SETUP.sql`
5. Go to **Storage** and create a new bucket:
   - Name: `client-assets`
   - Make it **public**

### Step 3: Get Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to **API Keys** and create a new key
4. Copy the API key (starts with `sk-ant-`)

### Step 4: Configure Backend

```bash
cd backend
npm install
```

Create `.env` file in the `backend` folder:

```env
PORT=3001
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,docx,txt,png,jpg,jpeg,xlsx,csv

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

### Step 5: Configure Frontend

```bash
cd ../frontend
npm install
```

Create `.env` file in the `frontend` folder (optional):

```env
VITE_API_URL=http://localhost:3001
```

### Step 6: Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## Usage Guide

### Creating a Client

1. Click **"New Client"** on the dashboard
2. Enter client name (required)
3. Add description for context (optional)
4. Upload thumbnail image (optional)
5. Click **"Create Client"**

### Uploading Documents

1. Click on a client to open their workspace
2. Go to the **Documents** tab
3. Drag & drop files or click to browse
4. Wait for AI processing to complete (shown by green checkmark)
5. Click on a document to view its analysis

### Using the AI Chat

1. Open a client workspace
2. Go to the **AI Chat** tab
3. Type your question about the documents
4. Press Enter to send
5. The AI will respond using context from relevant documents

### Document Analysis Details

Each uploaded document is automatically analyzed for:

- **Title**: Descriptive 5-10 word title
- **Summary**: Comprehensive 200-500 word summary
- **Tags**: 5-10 relevant tags
- **Keywords**: 10-15 important keywords
- **Topic**: Main category (Legal, Marketing, Finance, etc.)
- **Sentiment**: Positive, Negative, or Neutral
- **Sentiment Score**: -1 (very negative) to 1 (very positive)

## API Endpoints

### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create new client
- `GET /api/clients/:id` - Get client by ID
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Documents
- `GET /api/documents/:clientId` - Get all documents for client
- `POST /api/documents/:clientId/upload` - Upload document
- `GET /api/documents/detail/:documentId` - Get document details
- `DELETE /api/documents/:documentId` - Delete document
- `POST /api/documents/search/:clientId` - Semantic search

### Chat
- `GET /api/chat/:clientId` - Get chat history
- `POST /api/chat/:clientId` - Send message
- `DELETE /api/chat/:clientId` - Clear chat history

## Deployment

### Deploy Backend (Railway)

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Connect your GitHub repository
4. Select the `backend` folder
5. Add environment variables from `.env`
6. Deploy

### Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set root directory to `frontend`
4. Add environment variable: `VITE_API_URL=<your-railway-url>`
5. Deploy

## Cost Estimates

### Supabase (Free Tier)
- Database: 500 MB
- Storage: 1 GB
- Bandwidth: 5 GB/month
- **Cost**: FREE

### Anthropic Claude API
- Document analysis: ~$0.01-0.05 per document
- Chat messages: ~$0.001-0.01 per message
- **Estimate**: $5-20/month for moderate use

### Deployment (Free Tiers)
- Railway: Free tier available
- Vercel: Free tier available
- **Total**: FREE (within limits)

## Troubleshooting

### Backend won't start
- Check that all environment variables are set correctly
- Verify Supabase connection with `npm run dev`
- Check that port 3001 is not in use

### Documents not processing
- Verify Anthropic API key is valid
- Check backend logs for errors
- Ensure file types are supported

### Chat not working
- Verify documents have been processed (look for green checkmarks)
- Check that client has uploaded documents
- Review backend logs for API errors

### File upload fails
- Check file size is under 10MB
- Verify file type is supported
- Ensure Supabase storage bucket is configured correctly

## Advanced Configuration

### Vector Search Optimization

For production use with large document collections, consider:

1. **Use a proper embedding model**:
   - Replace the simple hash-based embedding in `claudeService.js`
   - Use OpenAI embeddings (`text-embedding-3-small`)
   - Or use Cohere embeddings

2. **Optimize pgvector**:
   - Tune HNSW index parameters (`m`, `ef_construction`)
   - Use appropriate distance metric (cosine, L2, inner product)

3. **Implement chunking**:
   - Split large documents into smaller chunks
   - Store chunks separately with references
   - Improve retrieval accuracy

### Authentication

To add user authentication:

1. Enable Supabase Auth
2. Update RLS policies in database
3. Add auth middleware to backend
4. Implement login/signup in frontend

### Performance Optimization

- Enable Redis caching for frequently accessed data
- Implement CDN for static assets
- Use database connection pooling
- Add request rate limiting
- Implement lazy loading in frontend

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for commercial or personal use.

## Support

For issues and questions:
- Check the troubleshooting section
- Review the architecture documentation
- Open an issue on GitHub

## Roadmap

Future enhancements:
- [ ] Multi-user support with authentication
- [ ] Document versionings
- [ ] OCR for scanned documents
- [ ] Audio/video transcription
- [ ] Advanced analytics dashboard
- [ ] Export functionality
- [ ] Webhook integrations
- [ ] Mobile app
- [ ] Real-time collaboration

---

Built with ❤️ using Claude AI, React, and Supabase


Calls:
CJ's Arboretum is a botanical gardens in the great state of Dallas TX. It is over 9,000sq/ft, and has a variety of tress including aspen, birch, oak, spruce, redwood, and cherry blossom. The price of admission is $12 a day and parking is $5. A yearly membership is $150 with parking included.