# Quick Start Guide - Contract Hub

Get up and running with Contract Hub in 5 minutes!

## Step 1: Get Google Gemini API Key

Visit [Google AI Studio](https://makersuite.google.com/app/apikey) and create a free API key.

No installation required - Gemini runs in the cloud!

## Step 2: Install Dependencies

Open terminal in the project folder:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

## Step 3: Setup Database

```bash
cd backend
npm run seed
```

This creates sample templates and proposals.

## Step 4: Configure Environment

Create `.env` file in backend folder:

```bash
cd backend
cp .env.example .env
```

Add your Gemini API key:

```env
GEMINI_API_KEY=your_api_key_here
```

## Step 5: Start Backend

```bash
# In backend folder
cd backend
npm run dev
```

You should see:
```
✅ Database schema initialized
✅ Embedding model loaded
✅ Gemini API configured
🎯 Server running on http://localhost:3001
```

## Step 6: Start Frontend

```bash
# In a NEW terminal, in frontend folder
cd frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in XXX ms
  ➜  Local:   http://localhost:3000/
```

## Step 8: Login and Explore

1. Open browser: http://localhost:3000
2. Click "Admin" quick login button
3. Or manually enter:
   - Email: `admin@contracthub.com`
   - Password: `admin123`

## Step 9: Generate Your First Contract

1. Click **"Generate Contract"** on dashboard
2. Select a proposal (e.g., "Enterprise Software Development")
3. Select template (e.g., "Master Services Agreement")
4. Click **"Generate Contract"**
5. Wait 30-60 seconds (first generation is slower)
6. View your AI-generated contract!

## Step 10: Validate the Contract

1. Click **"Validate Contract"** button
2. See the validation report:
   - Overall score
   - Field checks (parties, price, dates)
   - Semantic checks (scope, deliverables)
   - Mismatches and suggestions

## Access

No login required! The dashboard loads directly at `http://localhost:3000`.

The seeding created sample templates and proposals for testing.

## Common Issues

### "Gemini API key not configured"
- Make sure you added `GEMINI_API_KEY=your_key_here` to your `.env` file
- Verify your API key is valid at [Google AI Studio](https://makersuite.google.com/app/apikey)

### "Failed to generate contract"
- Check your Gemini API quota and billing status
- Ensure your API key has the necessary permissions

### Port already in use
- Backend (3001) or frontend (3000) port is taken
- Change port in `.env` (backend) or `vite.config.js` (frontend)

### Generation is slow
- First generation loads the model (~30s)
- Subsequent generations are faster (~10s)
- Running on CPU takes longer than GPU

### Dependencies won't install
- Make sure you have Node.js v18+: `node --version`
- Clear cache and retry: `npm cache clean --force && npm install`

## Next Steps

- Explore the **Proposals** page
- Create new proposals and templates
- Try different templates (MSA vs SOW)
- Upload documents to the knowledge base (coming soon)
- Experiment with validation thresholds

## Architecture at a Glance

```
Browser (React)
    ↓
Express API (Node.js)
    ↓
┌────────────────┐
│ RAG Pipeline   │
│ - Retrieval    │ ← ChromaDB (vectors)
│ - Generation   │ ← Ollama (LLM)
│ - Validation   │
└────────────────┘
    ↓
SQLite (metadata)
```

## What's Happening Under the Hood?

When you generate a contract:

1. **Retrieval**: System searches ChromaDB for similar contract clauses
2. **Context Building**: Combines proposal data + template + retrieved clauses
3. **Generation**: Ollama LLM generates contract text
4. **Template Merge**: Fills placeholders and applies conditional clauses
5. **Storage**: Saves to database with audit trail

When you validate:

1. **Rule Checks**: Verifies parties, prices, dates match proposal
2. **Semantic Checks**: Calculates similarity between proposal and contract sections
3. **Scoring**: Generates overall score and severity
4. **Report**: Creates detailed mismatch report with suggestions

## Features to Try

- **Dashboard**: Overview of contracts, proposals, templates
- **Generate Contract**: Create AI-powered contracts from proposals
- **Validate**: Check contract alignment with proposals
- **Templates**: View and manage contract templates
- **Proposals**: Browse and edit business proposals
- **Audit Trail**: Every action is logged (check browser network tab)

## Performance Tips

- First generation: ~30-60s (model loading)
- Subsequent: ~10-20s
- Validation: ~5-10s
- Use a GPU for faster generation (if available)

## Ready to Deploy?

For production deployment:
1. Set strong JWT_SECRET in `.env`
2. Use PostgreSQL instead of SQLite
3. Add HTTPS/SSL certificates
4. Set up monitoring (Prometheus/Grafana)
5. Configure backups
6. Add rate limiting
7. Enable logging (Winston)

## Need Help?

- Check the main README.md for detailed docs
- Review inline code comments
- Check Ollama logs: `ollama logs`
- Check backend logs in terminal
- Inspect browser console for frontend errors

## Resources

- Ollama: https://ollama.ai
- ChromaDB: https://www.trychroma.com/
- React: https://react.dev/
- Express: https://expressjs.com/
- Vite: https://vitejs.dev/

---

Happy contracting! 🎉
