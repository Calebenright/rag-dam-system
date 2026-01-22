# System Flow Diagrams

## Document Upload & Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER UPLOADS FILE                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend: DocumentUpload Component                              │
│  • User drags/drops file or clicks to browse                    │
│  • File validation (type, size)                                 │
│  • FormData creation                                            │
│  • Progress tracking                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  API: POST /api/documents/:clientId/upload                      │
│  • Multer receives file                                         │
│  • Saves to temp directory                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend: Upload to Supabase Storage                            │
│  • Generate unique filename                                     │
│  • Upload to client-assets bucket                               │
│  • Get public URL                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Database: Create Document Record                               │
│  • Insert into documents table                                  │
│  • processed = false (initially)                                │
│  • Return document ID to frontend                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend: Async Processing Starts                               │
│  • processDocumentAsync() called in background                  │
│  • User sees "Processing..." indicator                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Text Extraction                                        │
│  • fileProcessor.extractTextFromFile()                          │
│  • PDF → pdf-parse                                              │
│  • DOCX → mammoth                                               │
│  • TXT → fs.readFile                                            │
│  • XLSX/CSV → xlsx                                              │
│  • Images → placeholder (add OCR for production)                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: AI Analysis (Claude API)                               │
│  • claudeService.analyzeDocument()                              │
│  • Send content + prompt to Claude                              │
│  • Receive JSON response:                                       │
│    - title                                                      │
│    - summary (200-500 words)                                    │
│    - tags (5-10)                                                │
│    - keywords (10-15)                                           │
│    - topic                                                      │
│    - sentiment (positive/negative/neutral)                      │
│    - sentiment_score (-1 to 1)                                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Generate Embedding                                     │
│  • claudeService.generateEmbedding()                            │
│  • Combine title + summary + keywords                           │
│  • Generate 1536-dimensional vector                             │
│  • (Note: Use proper embedding model in production)             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Update Database                                        │
│  • Save all analysis results                                    │
│  • Store embedding as JSON                                      │
│  • Set processed = true                                         │
│  • Clean up temp file                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend: Auto-refresh                                         │
│  • React Query invalidates cache                                │
│  • Document list updates                                        │
│  • Green checkmark appears                                      │
│  • User can view analysis                                       │
└─────────────────────────────────────────────────────────────────┘
```

## RAG Chat Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SENDS CHAT MESSAGE                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend: ChatInterface Component                              │
│  • User types message                                           │
│  • Presses Enter or clicks Send                                 │
│  • Shows loading spinner                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  API: POST /api/chat/:clientId                                  │
│  • Receive message text                                         │
│  • Validate client exists                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Load Conversation History                              │
│  • Query chat_messages table                                    │
│  • Get last 10 messages                                         │
│  • Maintain context                                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Find Relevant Documents (RAG)                          │
│  • Option A: Simple keyword matching (current)                  │
│    - Split query into words                                     │
│    - Match against title/summary/keywords                       │
│                                                                  │
│  • Option B: Vector search (production)                         │
│    - Generate embedding for query                               │
│    - Use cosine similarity                                      │
│    - Query: search_documents() function                         │
│                                                                  │
│  • Return top 5 most relevant documents                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Build Context                                          │
│  • Add client description (working memory)                      │
│  • For each relevant document:                                  │
│    - Document title                                             │
│    - Summary                                                    │
│    - Keywords                                                   │
│  • Format as context string                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Call Claude API                                        │
│  • claudeService.chatWithContext()                              │
│  • System prompt with document context                          │
│  • Conversation history                                         │
│  • User's new message                                           │
│  • Generate response                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Save Messages                                          │
│  • Save user message to database                                │
│    - role: 'user'                                               │
│    - content: original message                                  │
│    - context_docs: [doc IDs]                                    │
│                                                                  │
│  • Save assistant response to database                          │
│    - role: 'assistant'                                          │
│    - content: Claude's response                                 │
│    - context_docs: [doc IDs]                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend: Display Response                                     │
│  • Show assistant message in chat                               │
│  • Display source documents indicator                           │
│  • Scroll to bottom                                             │
│  • Clear input field                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Database Relationships

```
┌─────────────────────┐
│      clients        │
│─────────────────────│
│ id (PK)            │
│ name               │◄──────┐
│ description        │       │
│ thumbnail_url      │       │ One-to-Many
│ created_at         │       │
│ updated_at         │       │
└─────────────────────┘       │
                              │
                    ┌─────────┴──────────┐
                    │                    │
         ┌──────────┴─────────┐  ┌──────┴──────────┐
         │     documents       │  │  chat_messages  │
         │─────────────────────│  │─────────────────│
         │ id (PK)            │  │ id (PK)         │
         │ client_id (FK)     │  │ client_id (FK)  │
         │ file_name          │  │ role            │
         │ file_url           │  │ content         │
         │ title              │  │ context_docs[]  │
         │ summary            │  │ created_at      │
         │ tags[]             │  └─────────────────┘
         │ keywords[]         │
         │ topic              │
         │ sentiment          │
         │ sentiment_score    │
         │ embedding (vector) │
         │ processed          │
         │ created_at         │
         └────────────────────┘
```

## Component Architecture

```
App.jsx
├── Routes
    ├── ClientsView.jsx (/)
    │   ├── CreateClientModal.jsx
    │   └── ClientCard.jsx (multiple)
    │
    └── ClientDetail.jsx (/client/:id)
        ├── Tabs
        │   ├── Documents Tab
        │   │   ├── DocumentUpload.jsx
        │   │   └── DocumentList.jsx
        │   │
        │   └── Chat Tab
        │       └── ChatInterface.jsx
        │
        └── API Calls
            ├── clientsApi
            ├── documentsApi
            └── chatApi
```

## Data Flow Summary

### Upload Flow
```
User → Frontend → API → Storage → Database → AI Processing → Update DB → Frontend Refresh
```

### Chat Flow
```
User → Frontend → API → Load History → Find Docs → Build Context → Claude AI → Save → Frontend Display
```

### Document Analysis
```
File → Extract Text → Claude Analysis → Generate Embedding → Store Results
```

## Key Technologies at Each Layer

### Frontend Layer
- **React**: UI rendering
- **TanStack Query**: Data fetching & caching
- **React Router**: Navigation
- **Axios**: HTTP requests

### API Layer
- **Express**: Request routing
- **Multer**: File uploads
- **CORS**: Cross-origin security

### Processing Layer
- **Claude AI**: Document analysis & chat
- **pdf-parse/mammoth/xlsx**: Text extraction
- **Vector generation**: Embeddings

### Storage Layer
- **Supabase Storage**: File storage
- **PostgreSQL**: Relational data
- **pgvector**: Vector search

## Security Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│  Security Layer                                                  │
├─────────────────────────────────────────────────────────────────┤
│  • CORS: Restrict origins                                       │
│  • Rate Limiting: Prevent abuse                                 │
│  • File Validation: Type & size checks                          │
│  • Input Sanitization: SQL injection prevention                 │
│  • Row Level Security: Multi-tenant isolation                   │
│  • API Keys: Environment variables only                         │
│  • HTTPS: Encrypted transmission (production)                   │
└─────────────────────────────────────────────────────────────────┘
```
