# Troubleshooting Guide

Common issues and their solutions.

## Installation Issues

### "Module not found" errors

**Problem**: Getting errors like `Cannot find module 'express'`

**Solution**:
```bash
# Make sure you're in the correct directory
cd backend  # or cd frontend

# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
```

### "Node version too old"

**Problem**: Error says Node version is incompatible

**Solution**:
```bash
# Check your Node version
node --version

# Should be 18.0.0 or higher
# If not, install latest Node.js from nodejs.org

# Or use nvm:
nvm install 18
nvm use 18
```

## Backend Issues

### "Port 3001 already in use"

**Problem**: Can't start backend, port is occupied

**Solution**:
```bash
# Find and kill the process
lsof -ti:3001 | xargs kill -9

# Or use a different port in .env
PORT=3002
```

### "Supabase connection failed"

**Problem**: Backend can't connect to database

**Solutions**:

1. **Check credentials**:
   - Verify `SUPABASE_URL` in `.env`
   - Should be: `https://xxxxx.supabase.co`
   - Verify `SUPABASE_SERVICE_KEY` (not anon key!)

2. **Check Supabase project**:
   - Make sure project is not paused
   - Go to Supabase dashboard
   - Wake up project if needed

3. **Test connection**:
   ```bash
   node -e "console.log(require('dotenv').config()); console.log(process.env.SUPABASE_URL)"
   ```

### "Anthropic API error"

**Problem**: Document processing fails with API error

**Solutions**:

1. **Check API key**:
   - Verify `ANTHROPIC_API_KEY` in `.env`
   - Should start with `sk-ant-`
   - Make sure there are no spaces

2. **Check API credits**:
   - Go to console.anthropic.com
   - Check your billing/credits
   - Add payment method if needed

3. **Check rate limits**:
   - You might be making too many requests
   - Wait a minute and try again

### "File upload fails"

**Problem**: Files won't upload

**Solutions**:

1. **Check file size**:
   ```bash
   # Files must be under 10MB
   # Check size: ls -lh yourfile.pdf
   ```

2. **Check file type**:
   - Supported: PDF, DOCX, TXT, PNG, JPG, XLSX, CSV
   - Not supported: PPTX, ZIP, EXE, etc.

3. **Check storage bucket**:
   - Go to Supabase → Storage
   - Verify `client-assets` bucket exists
   - Make sure it's public

4. **Check permissions**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT * FROM storage.buckets WHERE name = 'client-assets';
   ```

## Frontend Issues

### "Cannot connect to backend"

**Problem**: Frontend shows network errors

**Solutions**:

1. **Check backend is running**:
   ```bash
   # In backend directory
   npm run dev
   # Should see: "Server running on port 3001"
   ```

2. **Check URL**:
   - Frontend expects backend at `http://localhost:3001`
   - Check browser console for actual URL being used
   - Verify `VITE_API_URL` in frontend `.env` (if set)

3. **Check CORS**:
   - Backend should allow `http://localhost:3000`
   - Check `FRONTEND_URL` in backend `.env`

### "Blank page / white screen"

**Problem**: Frontend loads but shows nothing

**Solutions**:

1. **Check browser console**:
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Usually a JavaScript error

2. **Clear cache**:
   - Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R)
   - Or clear browser cache completely

3. **Check build**:
   ```bash
   cd frontend
   rm -rf node_modules .vite
   npm install
   npm run dev
   ```

### "Images not loading"

**Problem**: Thumbnails or documents don't display

**Solutions**:

1. **Check Supabase storage**:
   - Go to Supabase → Storage → client-assets
   - Verify files are there
   - Check bucket is public

2. **Check URLs**:
   - Open DevTools → Network tab
   - Look for failed image requests
   - Check the URL format

## Document Processing Issues

### Documents stuck on "Processing..."

**Problem**: Documents never finish processing

**Solutions**:

1. **Check backend logs**:
   - Look in terminal running backend
   - Should see: "Processing document {id}..."
   - Look for error messages

2. **Check document manually**:
   ```sql
   -- Run in Supabase SQL Editor
   SELECT id, file_name, processed, title, summary
   FROM documents
   WHERE processed = false;
   ```

3. **Retry processing**:
   - Delete the document
   - Upload again
   - Watch backend logs

4. **Check file content**:
   - Make sure file isn't corrupted
   - Try a simple test file (plain text)
   - Check file isn't password-protected

### "Insufficient text content extracted"

**Problem**: Processing fails with this error

**Solutions**:

1. **PDF files**:
   - File might be scanned (images, not text)
   - Need OCR (not implemented yet)
   - Try a text-based PDF

2. **DOCX files**:
   - File might be corrupted
   - Try opening in Word first
   - Save as new file

3. **Image files**:
   - Text extraction from images requires OCR
   - Not implemented in basic version
   - Use PDF with text instead

## Chat Issues

### Chat not responding

**Problem**: AI chat doesn't answer

**Solutions**:

1. **Check documents are processed**:
   - Look for green checkmarks
   - At least one document must be processed

2. **Check Anthropic API**:
   - Same as document processing above
   - Check API key and credits

3. **Check network**:
   - Open DevTools → Network tab
   - Send a message
   - Look for failed requests

### Chat gives generic answers

**Problem**: AI doesn't seem to know about documents

**Solutions**:

1. **Check document relevance**:
   - Current system uses keyword matching
   - Try mentioning specific words from documents
   - For better results, implement proper vector search

2. **Check client description**:
   - Add context in client description
   - This gives AI more context

3. **Try different questions**:
   - Instead of: "What is this about?"
   - Try: "What does document X say about Y?"

## Database Issues

### "Table does not exist"

**Problem**: Error about missing tables

**Solution**:
```sql
-- Run the full setup script again
-- Copy/paste contents of docs/DATABASE_SETUP.sql
-- into Supabase SQL Editor and run
```

### "Column does not exist"

**Problem**: Error about missing columns

**Solution**:
```sql
-- Check table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents';

-- If missing, run DATABASE_SETUP.sql again
```

### "Row Level Security policy violation"

**Problem**: Can't read/write data

**Solution**:
```sql
-- Check RLS is enabled but policies allow access
-- For development, we use permissive policies

-- Verify policies exist:
SELECT * FROM pg_policies WHERE tablename = 'clients';

-- If missing, run DATABASE_SETUP.sql
```

## Performance Issues

### Slow document processing

**Problem**: Takes forever to process documents

**Causes**:
- Large files (close to 10MB limit)
- Many documents processing simultaneously
- Anthropic API rate limits
- Network latency

**Solutions**:
- Process one document at a time
- Split large files into smaller ones
- Wait between uploads

### Slow chat responses

**Problem**: AI takes long to respond

**Causes**:
- Many documents to search through
- Long conversation history
- Anthropic API latency

**Solutions**:
- Clear chat history periodically
- Limit number of documents per client
- Upgrade to faster Claude model (Haiku)

## Deployment Issues

### Vercel deployment fails

**Problem**: Frontend won't deploy

**Solutions**:

1. **Check build command**:
   ```json
   // In frontend/package.json
   "scripts": {
     "build": "vite build"
   }
   ```

2. **Check output directory**:
   - Should be `dist`
   - Set in Vercel settings

3. **Check environment variables**:
   - Add `VITE_API_URL` in Vercel
   - Should point to your backend URL

### Railway deployment fails

**Problem**: Backend won't deploy

**Solutions**:

1. **Check start command**:
   ```json
   // In backend/package.json
   "scripts": {
     "start": "node server.js"
   }
   ```

2. **Check port**:
   ```javascript
   // In server.js
   const PORT = process.env.PORT || 3001;
   ```

3. **Check environment variables**:
   - All variables from `.env` must be in Railway
   - Don't forget `NODE_ENV=production`

## Getting More Help

### Enable Debug Mode

Backend:
```javascript
// In server.js, before starting server
console.log('Environment:', process.env.NODE_ENV);
console.log('Supabase URL:', process.env.SUPABASE_URL);
console.log('Port:', process.env.PORT);
```

Frontend:
```javascript
// In browser console
localStorage.debug = '*';
```

### Check Logs

**Backend logs**:
```bash
# Make sure you're viewing the terminal running npm run dev
# Look for error messages, especially after uploading files
```

**Frontend logs**:
```javascript
// Open browser DevTools (F12)
// Console tab - JavaScript errors
// Network tab - Failed requests
```

**Database logs**:
- Supabase Dashboard → Logs
- See all database queries
- Filter by error level

### Useful Debug Queries

```sql
-- Check all clients
SELECT * FROM clients ORDER BY created_at DESC;

-- Check document processing status
SELECT
  id,
  file_name,
  processed,
  created_at,
  CASE
    WHEN processed THEN 'Done'
    ELSE 'Processing'
  END as status
FROM documents
ORDER BY created_at DESC;

-- Check recent chat messages
SELECT
  role,
  LEFT(content, 50) as preview,
  created_at
FROM chat_messages
ORDER BY created_at DESC
LIMIT 10;

-- Check storage bucket
SELECT * FROM storage.buckets;

-- Check storage objects
SELECT * FROM storage.objects
WHERE bucket_id = 'client-assets'
ORDER BY created_at DESC;
```

### Still Stuck?

1. **Read error messages carefully**
   - Usually they tell you exactly what's wrong
   - Google the exact error message

2. **Check the architecture docs**
   - `docs/ARCHITECTURE.md`
   - `docs/SYSTEM_FLOW.md`

3. **Compare with working code**
   - Check if you modified any core files
   - Compare with original repository

4. **Start fresh**
   - Sometimes easiest to start over
   - Make sure to follow QUICKSTART.md exactly

5. **Create an issue**
   - Describe what you did
   - Include error messages
   - Share relevant logs
