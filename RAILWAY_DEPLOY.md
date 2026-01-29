# Railway Deployment Guide for Internal Client Application

This guide walks you through deploying the Internal Client Application to Railway.

## Prerequisites

- A [Railway account](https://railway.app)
- Railway CLI installed (optional): `npm install -g @railway/cli`
- Git repository connected to Railway

## Architecture

The app consists of two services:
- **Backend** (`/backend`) - Node.js/Express API on port 3001
- **Frontend** (`/frontend`) - React/Vite static site

## Quick Deploy (Railway Dashboard)

### Step 1: Create a New Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account and select this repository

### Step 2: Create Backend Service

1. Click **"New Service"** → **"GitHub Repo"**
2. Select the same repo
3. Railway will auto-detect the monorepo. Configure:
   - **Root Directory**: `backend`
   - **Service Name**: `internal-client-app-api`

4. Add these **Environment Variables** (Settings → Variables):

```
NODE_ENV=production
SUPABASE_URL=https://bbznigedjnrtaoxqxyfz.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your-key>
SUPABASE_SECRET_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>
OPENAI_API_KEY=<your-key>
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,docx,txt,png,jpg,jpeg,xlsx,csv
FRONTEND_URL=<your-frontend-railway-url>
DODEKA_API_KEY=<your-key>
```

> **Note**: `PORT` is automatically set by Railway - don't add it manually.

5. For Google Sheets integration, base64 encode your credentials and add:
```
GOOGLE_SHEETS_CREDENTIALS=<base64-encoded-json>
```

To create the base64 string:
```bash
base64 -i google-credentials.json | tr -d '\n'
```

### Step 3: Create Frontend Service

1. Click **"New Service"** → **"GitHub Repo"**
2. Select the same repo
3. Configure:
   - **Root Directory**: `frontend`
   - **Service Name**: `internal-client-app-frontend`

4. Add **Environment Variables**:

```
VITE_API_URL=<your-backend-railway-url>
```

> **Important**: Use the full Railway URL for the backend (e.g., `https://internal-client-app-api-production.up.railway.app`)

### Step 4: Generate Domains

1. For each service, go to **Settings → Networking**
2. Click **"Generate Domain"** to get a public URL
3. Update the environment variables:
   - Backend's `FRONTEND_URL` → Frontend's Railway URL
   - Frontend's `VITE_API_URL` → Backend's Railway URL

### Step 5: Deploy

Railway will automatically deploy when you push to your connected branch.

To manually redeploy: **Service → Deployments → Redeploy**

## CLI Deployment (Alternative)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project (run from App/ directory)
railway init

# Link to existing project
railway link

# Deploy backend
cd backend
railway up

# Deploy frontend
cd ../frontend
railway up
```

## Environment Variables Reference

### Backend Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Set to `production` | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | Yes |
| `SUPABASE_SECRET_KEY` | Supabase secret key | Yes |
| `ANTHROPIC_API_KEY` | Claude AI API key | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `FRONTEND_URL` | Frontend URL for CORS | Yes |
| `MAX_FILE_SIZE` | Max upload size (bytes) | No (default: 10MB) |
| `ALLOWED_FILE_TYPES` | Comma-separated file types | No |
| `DODEKA_API_KEY` | API key for uploads | No |
| `GOOGLE_SHEETS_CREDENTIALS` | Base64-encoded Google creds | If using Sheets |

### Frontend Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API URL | Yes |

## Google Credentials Setup

Since Railway doesn't support file uploads for credentials, base64 encode your `google-credentials.json`:

```bash
# On Mac/Linux
base64 -i google-credentials.json | tr -d '\n'

# On Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-credentials.json"))
```

The backend already supports this via the `GOOGLE_SHEETS_CREDENTIALS` environment variable.

## Health Check

Backend exposes `/health` endpoint. Railway will use this for health monitoring.

Test locally:
```bash
curl http://localhost:3001/health
# Returns: {"status":"ok","timestamp":"...","uptime":...}
```

## Troubleshooting

### Build Fails
- Check build logs in Railway dashboard
- Ensure `nixpacks.toml` is present in service root
- Verify Node.js version compatibility

### CORS Errors
- Ensure `FRONTEND_URL` in backend matches the actual frontend Railway URL
- Include the protocol (`https://`)

### Database Connection Issues
- Verify Supabase URL and keys are correct
- Check if Supabase allows connections from Railway IPs

### Frontend Shows Blank Page
- Check browser console for errors
- Verify `VITE_API_URL` is set correctly
- Ensure frontend build completed successfully

## Cost Estimation

Railway's pricing (as of 2024):
- **Hobby Plan**: $5/month includes $5 of usage
- **Pro Plan**: $20/month includes $10 of usage
- Usage: ~$0.000231/GB-minute for memory

For this app (low traffic):
- Backend: ~$2-5/month
- Frontend: ~$1-2/month
- **Total**: ~$5-10/month

## Useful Commands

```bash
# View logs
railway logs

# Open project in browser
railway open

# Check service status
railway status

# Set environment variable
railway variables set KEY=value

# Run command in Railway environment
railway run npm test
```

## Next Steps After Deployment

1. Test the health endpoint: `https://your-backend.up.railway.app/health`
2. Test the frontend loads correctly
3. Verify API calls work (check browser Network tab)
4. Set up custom domains if needed (Settings → Domains)
5. Configure monitoring/alerts in Railway dashboard
