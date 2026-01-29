# Internal Client Application - Complete File Index

## 📁 Project Overview

**Total Files**: 39 files
**Backend Files**: 7 JavaScript files
**Frontend Files**: 16 JSX/JavaScript files
**Configuration**: 7 config files
**Documentation**: 9 markdown files

---

## 📚 Documentation Files (Read These First!)

### Getting Started
1. **README.md** - Main documentation, start here
2. **QUICKSTART.md** - 15-minute setup guide
3. **PROJECT_SUMMARY.md** - Complete project overview

### Technical Documentation
4. **docs/ARCHITECTURE.md** - System design and architecture
5. **docs/SYSTEM_FLOW.md** - Visual flow diagrams
6. **docs/DATABASE_SETUP.sql** - Database schema (run this!)
7. **docs/TROUBLESHOOTING.md** - Common issues and solutions
8. **docs/UI_GUIDE.md** - User interface reference
9. **INDEX.md** - This file

---

## 🔧 Backend Files (`/backend`)

### Configuration
- **config/supabase.js** - Database connection setup
- **.env.example** - Environment variables template
- **package.json** - Dependencies and scripts
- **server.js** - Express server entry point

### API Routes
- **routes/clients.js** - Client CRUD operations
  - GET, POST, PUT, DELETE endpoints
  - Thumbnail upload handling
  - Client management logic

- **routes/documents.js** - Document management
  - File upload endpoint
  - Document processing pipeline
  - Semantic search
  - Document deletion

- **routes/chat.js** - RAG chat functionality
  - Chat history
  - Message sending with context
  - Conversation management

### Services
- **services/claudeService.js** - Claude AI integration
  - Document analysis (title, summary, tags, keywords, topic, sentiment)
  - Vector embedding generation
  - RAG chat with context

- **services/fileProcessor.js** - File text extraction
  - PDF text extraction (pdf-parse)
  - DOCX text extraction (mammoth)
  - Text file reading
  - Spreadsheet parsing (xlsx)
  - File validation

---

## 🎨 Frontend Files (`/frontend`)

### Entry Points
- **index.html** - HTML template
- **src/main.jsx** - React app entry point
- **src/App.jsx** - Main app component with routing
- **src/index.css** - Global styles (Tailwind imports)

### Configuration
- **package.json** - Dependencies and scripts
- **vite.config.js** - Vite build configuration
- **tailwind.config.js** - Tailwind CSS theme
- **postcss.config.js** - PostCSS configuration

### API Client Layer
- **src/api/axios.js** - Axios instance configuration
- **src/api/clients.js** - Client API functions
- **src/api/documents.js** - Document API functions
- **src/api/chat.js** - Chat API functions

### Pages (Main Views)
- **src/pages/ClientsView.jsx** - Dashboard with client folders
  - Grid layout of clients
  - Search functionality
  - Create new client button

- **src/pages/ClientDetail.jsx** - Client workspace
  - Tab navigation (Documents/Chat)
  - Client header with info
  - Route management

### Components
- **src/components/ClientCard.jsx** - Client folder card
  - Thumbnail display
  - Client info
  - Delete functionality

- **src/components/CreateClientModal.jsx** - New client modal
  - Form for client creation
  - Thumbnail upload
  - Validation

- **src/components/DocumentUpload.jsx** - File upload interface
  - Drag-and-drop zone
  - Upload progress tracking
  - Multiple file handling
  - Real-time status updates

- **src/components/DocumentList.jsx** - Document grid/list
  - Document cards with status
  - Click to view details
  - Delete functionality
  - Analysis results display

- **src/components/ChatInterface.jsx** - RAG chat UI
  - Message history
  - Input field
  - AI responses
  - Context document indicators
  - Clear history

---

## 📊 Database Schema (`docs/DATABASE_SETUP.sql`)

### Tables
1. **clients**
   - id (UUID, primary key)
   - name (text)
   - description (text)
   - thumbnail_url (text)
   - timestamps

2. **documents**
   - id (UUID, primary key)
   - client_id (foreign key)
   - file metadata (name, type, url, size)
   - AI analysis results (title, summary, tags, keywords, topic)
   - sentiment data
   - embedding (vector)
   - processed status

3. **chat_messages**
   - id (UUID, primary key)
   - client_id (foreign key)
   - role (user/assistant)
   - content (text)
   - context_docs (array)
   - timestamp

### Storage
- **client-assets** bucket
  - Stores uploaded files
  - Stores client thumbnails

### Functions
- **search_documents()** - Vector similarity search
- **get_topic_stats()** - Document statistics by topic

### Views
- **clients_with_stats** - Clients with document counts

---

## 🗂️ File Organization

```
internal-client-app/
│
├── 📄 README.md                    # Main documentation
├── 📄 QUICKSTART.md                # Fast setup guide
├── 📄 PROJECT_SUMMARY.md           # Project overview
├── 📄 INDEX.md                     # This file
├── 📄 .gitignore                   # Git ignore rules
│
├── 📁 backend/                     # Node.js API
│   ├── 📁 config/
│   │   └── supabase.js
│   ├── 📁 routes/
│   │   ├── clients.js
│   │   ├── documents.js
│   │   └── chat.js
│   ├── 📁 services/
│   │   ├── claudeService.js
│   │   └── fileProcessor.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── 📁 frontend/                    # React app
│   ├── 📁 src/
│   │   ├── 📁 api/
│   │   │   ├── axios.js
│   │   │   ├── clients.js
│   │   │   ├── documents.js
│   │   │   └── chat.js
│   │   ├── 📁 components/
│   │   │   ├── ClientCard.jsx
│   │   │   ├── CreateClientModal.jsx
│   │   │   ├── DocumentUpload.jsx
│   │   │   ├── DocumentList.jsx
│   │   │   └── ChatInterface.jsx
│   │   ├── 📁 pages/
│   │   │   ├── ClientsView.jsx
│   │   │   └── ClientDetail.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
└── 📁 docs/                        # Documentation
    ├── ARCHITECTURE.md
    ├── DATABASE_SETUP.sql
    ├── SYSTEM_FLOW.md
    ├── TROUBLESHOOTING.md
    └── UI_GUIDE.md
```

---

## 🚀 Quick Command Reference

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Database Setup
1. Go to Supabase SQL Editor
2. Copy contents of `docs/DATABASE_SETUP.sql`
3. Paste and run

### Production Build
```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run build
```

---

## 📋 File Dependencies

### Backend Dependencies (package.json)
```
Core:
- express (API framework)
- @anthropic-ai/sdk (Claude AI)
- @supabase/supabase-js (database)

File Processing:
- multer (file uploads)
- pdf-parse (PDF extraction)
- mammoth (DOCX extraction)
- xlsx (spreadsheet parsing)
- sharp (image processing)

Utilities:
- dotenv (environment variables)
- cors (cross-origin requests)
- helmet (security)
- morgan (logging)
- uuid (ID generation)
```

### Frontend Dependencies (package.json)
```
Core:
- react (UI framework)
- react-dom (React renderer)
- react-router-dom (routing)

Data Management:
- @tanstack/react-query (data fetching)
- axios (HTTP client)

UI:
- tailwindcss (styling)
- lucide-react (icons)
- react-dropzone (file uploads)
- clsx (class utilities)

Build:
- vite (build tool)
- @vitejs/plugin-react (React plugin)
```

---

## 🔍 Key Features by File

### Document Upload Flow
1. **DocumentUpload.jsx** - UI for drag/drop
2. **documents.js** (API) - Receives file
3. **fileProcessor.js** - Extracts text
4. **claudeService.js** - AI analysis
5. **documents.js** (API) - Saves to database

### Chat Flow
1. **ChatInterface.jsx** - User input
2. **chat.js** (API) - Receives message
3. **documents.js** (API) - Searches documents
4. **claudeService.js** - Generates response
5. **ChatInterface.jsx** - Displays response

### Client Management
1. **ClientsView.jsx** - Lists clients
2. **CreateClientModal.jsx** - Create form
3. **clients.js** (API) - CRUD operations
4. **ClientCard.jsx** - Display card
5. **ClientDetail.jsx** - Detail view

---

## 🎯 Next Steps

1. **Setup**: Follow `QUICKSTART.md`
2. **Understand**: Read `ARCHITECTURE.md`
3. **Customize**: Modify components as needed
4. **Deploy**: Follow deployment section in `README.md`
5. **Troubleshoot**: Check `TROUBLESHOOTING.md` if issues arise

---

## 💡 Tips for Navigation

### For Developers
- Start with **backend/server.js** to understand API structure
- Check **docs/ARCHITECTURE.md** for system overview
- Review **services/** for business logic
- Look at **routes/** for API endpoints

### For Frontend Developers
- Start with **src/App.jsx** for routing
- Check **src/pages/** for main views
- Review **src/components/** for UI components
- Look at **src/api/** for backend communication

### For DevOps
- Check **package.json** files for dependencies
- Review **.env.example** for required variables
- See **README.md** deployment section
- Check **docs/ARCHITECTURE.md** for infrastructure

### For Product Managers
- Read **PROJECT_SUMMARY.md** for overview
- Check **docs/UI_GUIDE.md** for interface
- Review **README.md** for features
- See **docs/SYSTEM_FLOW.md** for workflows

---

## 📧 Support

Can't find what you're looking for?

1. Check the **TROUBLESHOOTING.md** guide
2. Review the **README.md** FAQ section
3. Search through the documentation files
4. Check the code comments in source files
5. Create a GitHub issue with details

---

**Built with ❤️ using Claude AI**

Last updated: January 2026
