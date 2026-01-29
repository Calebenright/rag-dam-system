# Internal Client Application Architecture

## Overview
A sophisticated client management system with AI-powered document analysis and chat capabilities.

## System Components

### 1. Frontend (React)
- **Client Folder View**: Grid/list view of all clients with thumbnails
- **Client Detail View**: Individual client workspace with file management
- **File Upload Interface**: Drag-and-drop file uploads with progress tracking
- **AI Chat Interface**: Context-aware chat with document retrieval
- **Document Viewer**: Preview and metadata display for uploaded files

### 2. Backend (Node.js/Express)
- **REST API**: Client and document CRUD operations
- **File Processing Pipeline**:
  - File upload → text extraction → AI analysis → vector embedding → storage
- **AI Integration**: Claude API for document analysis
  - Summarization
  - Tag generation
  - Keyword extraction
  - Topic identification
  - Sentiment analysis
- **Vector Search**: Semantic search across documents
- **Chat Engine**: RAG-powered responses using document context

### 3. Database (Supabase - Free Tier)
- **PostgreSQL**: Relational data (clients, documents, metadata)
- **pgvector Extension**: Vector embeddings for semantic search
- **Storage Buckets**: File storage (documents, thumbnails)
- **Row Level Security**: Multi-tenant data isolation
- **Real-time Subscriptions**: Live updates (optional)

## Data Models

### Clients Table
```sql
- id (uuid, primary key)
- name (text)
- description (text) -- working memory
- thumbnail_url (text)
- created_at (timestamp)
- updated_at (timestamp)
```

### Documents Table
```sql
- id (uuid, primary key)
- client_id (uuid, foreign key)
- file_name (text)
- file_type (text)
- file_url (text)
- file_size (integer)
- title (text) -- AI-generated
- summary (text) -- AI-generated
- tags (text[]) -- AI-generated
- keywords (text[]) -- AI-generated
- topic (text) -- AI-generated
- sentiment (text) -- AI-generated: positive/negative/neutral
- sentiment_score (float) -- -1 to 1
- embedding (vector(1536)) -- for RAG
- created_at (timestamp)
- processed (boolean)
```

### Chat Messages Table
```sql
- id (uuid, primary key)
- client_id (uuid, foreign key)
- role (text) -- user/assistant
- content (text)
- context_docs (uuid[]) -- documents used for this response
- created_at (timestamp)
```

## AI Processing Pipeline

1. **File Upload** → Store in Supabase Storage
2. **Text Extraction** → Extract content based on file type
3. **AI Analysis** (Claude API):
   - Generate title
   - Create summary (200-500 words)
   - Extract tags (5-10 tags)
   - Identify keywords (10-15 keywords)
   - Determine topic category
   - Analyze sentiment
4. **Vector Embedding** → Generate embedding for semantic search
5. **Database Storage** → Save metadata and embedding
6. **Indexing** → Update vector search index

## RAG Chat Flow

1. **User Query** → Receive chat message
2. **Query Embedding** → Generate embedding for query
3. **Vector Search** → Find relevant documents (top 5)
4. **Context Assembly** → Combine document chunks with metadata
5. **AI Chat** → Send to Claude API with context
6. **Response** → Return answer with source documents
7. **Save History** → Store conversation

## Technology Stack

### Frontend
- React 18
- React Router (navigation)
- TanStack Query (data fetching)
- Tailwind CSS (styling)
- Lucide React (icons)
- React Dropzone (file uploads)
- Axios (HTTP client)

### Backend
- Node.js 18+
- Express.js (API framework)
- Multer (file uploads)
- pdf-parse (PDF extraction)
- mammoth (DOCX extraction)
- xlsx (spreadsheet parsing)
- sharp (image processing)
- @anthropic-ai/sdk (Claude API)
- @supabase/supabase-js (database)

### Database & Infrastructure
- Supabase (PostgreSQL + Storage + Auth)
- pgvector (vector similarity search)

## Security Considerations

1. **Authentication**: Supabase Auth (JWT tokens)
2. **Authorization**: Row-level security policies
3. **File Validation**: Type and size restrictions
4. **API Rate Limiting**: Prevent abuse
5. **Input Sanitization**: Prevent injection attacks
6. **CORS**: Restricted origins

## Scalability Considerations

1. **Async Processing**: Queue-based file processing
2. **Caching**: Redis for frequently accessed data
3. **CDN**: CloudFlare for static assets
4. **Database Indexing**: Optimize queries
5. **Vector Search Optimization**: HNSW indexes

## Free Tier Limits (Supabase)

- **Database**: 500 MB (PostgreSQL)
- **Storage**: 1 GB
- **Bandwidth**: 5 GB/month
- **API Requests**: Unlimited (with rate limits)

**Note**: Claude API costs apply per request. Estimate ~$0.01-0.05 per document analysis.

## Deployment Options

1. **Development**: localhost
2. **Production**:
   - Frontend: Vercel/Netlify (free)
   - Backend: Railway/Render (free tier)
   - Database: Supabase (free tier)

## Future Enhancements

- [ ] Multi-user collaboration
- [ ] Document versioning
- [ ] OCR for scanned documents
- [ ] Audio/video transcription
- [ ] Advanced analytics dashboard
- [ ] Export functionality (reports, summaries)
- [ ] Webhook integrations
- [ ] Mobile app
