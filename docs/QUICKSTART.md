# Quick Start Guide

Get your Internal Client Application up and running in 15 minutes!

## ⚡ Fast Track Setup

### 1. Prerequisites Check (2 min)

Make sure you have:
- ✅ Node.js 18+ installed (`node --version`)
- ✅ A Supabase account (sign up at [supabase.com](https://supabase.com))
- ✅ An Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))

### 2. Database Setup (3 min)

1. Create a new project in Supabase
2. Go to **SQL Editor** → **New Query**
3. Copy and paste the entire contents of `docs/DATABASE_SETUP.sql`
4. Click **Run**
5. Go to **Storage** → **New Bucket**:
   - Name: `client-assets`
   - Public: ✅ Yes

### 3. Get Your Credentials (2 min)

**Supabase** (Project Settings → API):
- Copy your **Project URL**
- Copy your **anon public key**
- Copy your **service_role key**

**Anthropic** (console.anthropic.com → API Keys):
- Create and copy your **API key**

### 4. Backend Setup (3 min)

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-...
```

Start the backend:
```bash
npm run dev
```

You should see: `🚀 Server running on port 3001`

### 5. Frontend Setup (3 min)

Open a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

You should see: `Local: http://localhost:3000`

### 6. Test It Out! (2 min)

1. Open http://localhost:3000 in your browser
2. Click **"New Client"**
3. Enter a name like "Test Client"
4. Click **"Create Client"**
5. Click on the client card
6. Upload a document (try a PDF or TXT file)
7. Wait for the green checkmark (AI is processing!)
8. Click on the document to see the AI analysis
9. Go to **"AI Chat"** tab and ask a question!

## 🎉 That's It!

Your Internal Client Application is now running locally.

## Next Steps

### Add More Clients
- Click "New Client" to add more clients
- Upload a thumbnail image to personalize each client
- Add a description to give the AI more context

### Upload Multiple Documents
- Drag and drop multiple files at once
- Supported formats: PDF, DOCX, TXT, PNG, JPG, XLSX, CSV
- Each file will be automatically analyzed

### Chat with Your Documents
- Ask questions like:
  - "What are the main topics in these documents?"
  - "Summarize the key points"
  - "What is the sentiment of document X?"
  - "Find documents about [topic]"

### Explore the Analysis
- Each document gets:
  - ✅ Auto-generated title
  - ✅ 200-500 word summary
  - ✅ 5-10 relevant tags
  - ✅ 10-15 keywords
  - ✅ Topic classification
  - ✅ Sentiment analysis

## Common Issues

### Port already in use?
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### "Connection refused" error?
- Make sure backend is running (`npm run dev` in backend folder)
- Check that `.env` file has correct Supabase credentials

### Documents not processing?
- Check that your Anthropic API key is valid
- Look at the backend terminal for error messages
- Make sure file size is under 10MB

### Can't create storage bucket?
- Make sure you're on the Storage page in Supabase
- Try refreshing the page
- Name must be exactly `client-assets`

## Development Tips

### View Backend Logs
The backend terminal shows:
- File uploads
- AI processing status
- Database queries
- Errors and warnings

### View Frontend Network Requests
Open browser DevTools → Network tab to see:
- API calls
- Upload progress
- Response data

### Database Access
Use Supabase dashboard → Table Editor to:
- View stored data
- Run queries
- Check processed documents

## Ready to Deploy?

See the **Deployment** section in README.md for instructions on deploying to:
- **Railway** (backend)
- **Vercel** (frontend)

Both have generous free tiers!

## Getting Help

- 📖 Read the full README.md for detailed documentation
- 🏗️ Check ARCHITECTURE.md for system design
- 💬 Review backend logs for error messages
- 🔍 Use browser DevTools to debug frontend issues

---

**Happy building! 🚀**
