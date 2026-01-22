# Deploy to Render.com

## Quickest Way: One-Click Deploy

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/rag-dam-system.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render will detect `render.yaml` and set up both services automatically

### Step 3: Add Environment Variables

In the Render dashboard, add these environment variables to **rag-dam-api**:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Your Supabase service role key |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `FRONTEND_URL` | `https://rag-dam-frontend.onrender.com` (or your custom domain) |
| `GOOGLE_SHEETS_CREDENTIALS` | Your Google service account JSON (base64 encoded) |

For the frontend **rag-dam-frontend**, add:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://rag-dam-api.onrender.com` |

---

## Manual Deploy (Alternative)

### Backend

1. Click **"New"** → **"Web Service"**
2. Connect repo, select `backend` as root directory
3. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node
4. Add environment variables listed above

### Frontend

1. Click **"New"** → **"Static Site"**
2. Connect repo, select `frontend` as root directory
3. Settings:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add `VITE_API_URL` environment variable

---

## Google Sheets Setup (if using)

1. Create a service account in Google Cloud Console
2. Enable Google Sheets API
3. Download JSON credentials
4. Base64 encode: `cat credentials.json | base64`
5. Add as `GOOGLE_SHEETS_CREDENTIALS` env var

---

## Database Migration

Run the migration in your Supabase SQL editor:
```sql
-- Located at: backend/migrations/add_connected_sheets.sql
```

---

## Post-Deploy Checklist

- [ ] Backend health check responds: `https://rag-dam-api.onrender.com/health`
- [ ] Frontend loads: `https://rag-dam-frontend.onrender.com`
- [ ] Create a test client
- [ ] Upload a test document
- [ ] Test chat functionality
- [ ] Test Google Sheets integration (if configured)

---

## Custom Domain (Optional)

1. In Render dashboard → Your service → Settings → Custom Domains
2. Add your domain
3. Update DNS records as instructed
4. Update `FRONTEND_URL` env var on backend
5. Update `VITE_API_URL` on frontend if using custom API domain

---

## Troubleshooting

### Backend not starting?
- Check logs in Render dashboard
- Verify all env vars are set
- Ensure Supabase URL/key are correct

### CORS errors?
- Make sure `FRONTEND_URL` is set correctly on backend
- Include `https://` in the URL

### Frontend shows API errors?
- Verify `VITE_API_URL` is set
- Must be full URL with `https://`
- Redeploy frontend after changing env vars

### Sheets integration not working?
- Ensure `GOOGLE_SHEETS_CREDENTIALS` is base64 encoded
- Service account needs Editor access to sheets
