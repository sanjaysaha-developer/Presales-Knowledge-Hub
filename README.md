# Contract Hub - RAG-based Contract Management System

A comprehensive enterprise contract management system powered by Retrieval-Augmented Generation (RAG), built with Node.js, React, and Ollama for local LLM processing.

## Features

- **RAG-Powered Contract Generation**: Generate contracts from proposals using AI with retrieval from a knowledge base
- **Template Management**: Create, version, and approve contract templates with placeholders and conditional logic
- **Smart Validation**: Validate contracts against proposals using rule-based and semantic checks
- **Knowledge Base**: Vector-based document storage for intelligent clause retrieval
- **Audit Trail**: Complete audit logging for all contract operations
- **Role-Based Access**: Admin, Legal, Business, and Viewer roles
- **Citation & Explainability**: Every generated clause includes evidence citations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  (Vite + React Router + Zustand + TailwindCSS)             │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────────┐
│                  Node.js Backend (Express)                   │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Services Layer                                     │    │
│  │  - Document Processor (PDF/DOCX/OCR)               │    │
│  │  - Embedding Service (ChromaDB + Transformers.js)  │    │
│  │  - RAG Service (Ollama LLM + Retrieval)           │    │
│  │  - Validation Service (Rule + Semantic)            │    │
│  │  - Template Engine (Handlebars)                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────┐        ┌──────────────┐              │
│  │  SQLite DB      │        │  ChromaDB    │              │
│  │  (Metadata)     │        │  (Vectors)   │              │
│  └─────────────────┘        └──────────────┘              │
└──────────────────────────────────┬───────────────────────────┘
                                   │
                      ┌────────────▼──────────┐
                      │   Ollama (Local LLM)  │
                      │   llama3.1:8b         │
                      └───────────────────────┘
```

## Tech Stack

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Vector Store**: ChromaDB
- **LLM**: Ollama (llama3.1:8b)
- **Embeddings**: @xenova/transformers (all-MiniLM-L6-v2)
- **Document Processing**: pdf-parse, mammoth, tesseract.js
- **Template Engine**: Handlebars
- **Auth**: JWT + bcryptjs

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: Zustand
- **Styling**: TailwindCSS
- **HTTP Client**: Axios

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher)
2. **Ollama** installed and running

### Installing Ollama

#### Windows
```bash
# Download from https://ollama.ai
# Or use winget:
winget install Ollama.Ollama
```

#### macOS
```bash
# Download from https://ollama.ai
# Or use Homebrew:
brew install ollama
```

#### Linux
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Pull the Required Model

```bash
# Pull the Llama 3.1 8B model
ollama pull llama3.1:8b

# Pull the embedding model (optional, transformers.js will handle this)
ollama pull nomic-embed-text
```

## Installation

### 1. Clone or Navigate to Project

```bash
cd "Office Project"
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Configure Environment

Create `.env` file in the `backend` folder:

```bash
cd ../backend
cp .env.example .env
```

Edit `.env` if needed (defaults should work):

```env
PORT=3001
NODE_ENV=development
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

## Running the Application

### 1. Start Ollama (if not already running)

```bash
# In a new terminal
ollama serve
```

### 2. Seed the Database

```bash
cd backend
npm run seed
```

This will create:
- 3 test users (admin, legal, business)
- 2 contract templates (MSA, SOW)
- 3 sample proposals

**Test Accounts:**
- **Admin**: admin@contracthub.com / admin123
- **Legal**: legal@contracthub.com / legal123
- **Business**: business@contracthub.com / business123

### 3. Start the Backend

```bash
cd backend
npm run dev
```

Backend will run on `http://localhost:3001`

### 4. Start the Frontend (in a new terminal)

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:3000`

### 5. Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

Login with one of the test accounts above.

## Usage Guide

### 1. Generate a Contract

1. Navigate to **Dashboard** or **Proposals**
2. Select a proposal
3. Click **"Generate Contract"**
4. Choose a template (MSA or SOW)
5. Click **"Generate Contract"**
6. Wait for the AI to generate the contract (may take 30-60 seconds on first run)

### 2. Validate a Contract

1. Go to **Contracts**
2. Click on a generated contract
3. Click **"Validate Contract"** button
4. View validation results showing:
   - Overall score
   - Field-level checks (parties, price, dates)
   - Semantic similarity checks
   - Mismatches and suggestions

### 3. Manage Templates

1. Navigate to **Templates**
2. View active templates
3. Admins and Legal users can create/edit templates
4. Templates support Handlebars syntax with placeholders

### 4. Work with Proposals

1. Navigate to **Proposals**
2. View all proposals with client info and pricing
3. Click a proposal to view details
4. Generate contracts directly from proposals

## API Reference

### Authentication

```
POST /api/v1/auth/login
POST /api/v1/auth/register
GET  /api/v1/auth/me
```

### Contracts

```
GET    /api/v1/contracts              # List all contracts
GET    /api/v1/contracts/:id          # Get contract details
POST   /api/v1/contracts/generate     # Generate new contract
PUT    /api/v1/contracts/:id          # Update contract
PUT    /api/v1/contracts/:id/status   # Update contract status
POST   /api/v1/contracts/:id/validate # Validate contract
DELETE /api/v1/contracts/:id          # Delete contract
```

### Proposals

```
GET    /api/v1/proposals        # List all proposals
GET    /api/v1/proposals/:id    # Get proposal details
POST   /api/v1/proposals        # Create proposal
PUT    /api/v1/proposals/:id    # Update proposal
DELETE /api/v1/proposals/:id    # Delete proposal
```

### Templates

```
GET    /api/v1/templates              # List all templates
GET    /api/v1/templates/:id          # Get template details
GET    /api/v1/templates/:id/preview  # Preview template
POST   /api/v1/templates              # Create template
PUT    /api/v1/templates/:id          # Update template
PUT    /api/v1/templates/:id/approve  # Approve template
DELETE /api/v1/templates/:id          # Delete template
```

## Project Structure

```
Office Project/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # SQLite database setup
│   │   ├── models/
│   │   │   └── index.js             # Database models
│   │   ├── services/
│   │   │   ├── documentProcessor.js # PDF/DOCX parsing
│   │   │   ├── embeddingService.js  # Vector embeddings
│   │   │   ├── ragService.js        # RAG generation
│   │   │   ├── validationService.js # Contract validation
│   │   │   └── templateEngine.js    # Template rendering
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── contracts.routes.js
│   │   │   ├── proposals.routes.js
│   │   │   └── templates.routes.js
│   │   ├── middleware/
│   │   │   └── auth.js              # JWT authentication
│   │   ├── utils/
│   │   │   └── seed.js              # Database seeding
│   │   └── server.js                # Express app
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx           # Main layout component
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Contracts.jsx
│   │   │   ├── ContractDetail.jsx
│   │   │   ├── Proposals.jsx
│   │   │   ├── Templates.jsx
│   │   │   └── GenerateContract.jsx
│   │   ├── services/
│   │   │   └── api.js               # API client
│   │   ├── utils/
│   │   │   └── store.js             # Zustand stores
│   │   ├── styles/
│   │   │   └── index.css            # Global styles
│   │   ├── App.jsx                  # Main app component
│   │   └── main.jsx                 # Entry point
│   ├── package.json
│   └── vite.config.js
│
├── data/
│   ├── contracts/                   # Uploaded contracts
│   ├── proposals/                   # Uploaded proposals
│   ├── templates/                   # Template files
│   │   └── msa-template.txt
│   └── knowledge-base/              # Documents for RAG
│
└── README.md
```

## How RAG Works in Contract Hub

### 1. Document Ingestion
- Upload PDFs, DOCX, or text files
- Text extraction and OCR if needed
- Chunk documents into ~800 character segments
- Generate embeddings using sentence transformers
- Store in ChromaDB vector database

### 2. Retrieval
- Convert proposal into search query
- Generate embedding for the query
- Find top-K most similar chunks from knowledge base
- Filter by metadata (contract type, date, etc.)

### 3. Generation
- Construct prompt with:
  - Template structure
  - Proposal data
  - Retrieved evidence chunks
- Send to Ollama LLM
- Merge generated text with template
- Replace placeholders with proposal values

### 4. Validation
- **Rule-based checks**: Extract and compare parties, prices, dates
- **Semantic checks**: Calculate similarity between proposal and contract sections
- **LLM validation**: Ask LLM to explain mismatches
- Generate detailed validation report

## Validation System

The validation engine performs multi-layer checks:

### Rule-Based Validation
- Client name presence
- Price matching (with tolerance)
- Date verification
- Payment terms matching

### Semantic Validation
- Project scope alignment (using embeddings)
- Deliverables completeness
- SLA terms consistency
- Cosine similarity threshold: 0.8

### Scoring
- Overall score = passed checks / total checks
- Severity levels: low, medium, high, critical
- Status: pass (>90%), warning (70-90%), fail (<70%)

## Troubleshooting

### Ollama Connection Error

```
⚠️ Ollama not available: connect ECONNREFUSED
```

**Solution**: Start Ollama:
```bash
ollama serve
```

### Model Not Found

```
Error: model 'llama3.1:8b' not found
```

**Solution**: Pull the model:
```bash
ollama pull llama3.1:8b
```

### Port Already in Use

```
Error: Port 3001 is already in use
```

**Solution**: Change port in `backend/.env`:
```env
PORT=3002
```

### ChromaDB Initialization Error

**Solution**: Ensure data directory exists:
```bash
mkdir -p data/chroma_db
```

### Frontend Can't Connect to Backend

**Solution**: Check backend is running on port 3001 and update `frontend/vite.config.js` if needed.

## Performance Considerations

- **First contract generation**: ~30-60 seconds (model loading)
- **Subsequent generations**: ~10-20 seconds
- **Validation**: ~5-10 seconds
- **Vector search**: <1 second

## Security Notes

- Change JWT_SECRET in production
- Use HTTPS in production
- Implement rate limiting
- Sanitize all user inputs
- Use environment variables for secrets

## Future Enhancements

- [ ] E-signature integration (DocuSign/Adobe Sign)
- [ ] Advanced OCR for scanned contracts
- [ ] Multi-language support
- [ ] Clause library management UI
- [ ] Collaborative editing
- [ ] Version control for contracts
- [ ] Email notifications
- [ ] CRM/ERP integrations
- [ ] Advanced analytics dashboard
- [ ] Bulk contract processing

## Contributing

This is a demonstration project. For production use:
1. Add comprehensive error handling
2. Implement request validation
3. Add unit and integration tests
4. Set up CI/CD pipeline
5. Configure production database (PostgreSQL)
6. Add monitoring and logging (Winston, Prometheus)

## License

MIT License

## Support

For issues and questions, refer to the documentation in `/docs` or check the inline code comments.

## Acknowledgments

- Built with [Ollama](https://ollama.ai) for local LLM processing
- Vector search powered by [ChromaDB](https://www.trychroma.com/)
- Embeddings by [Xenova/transformers.js](https://github.com/xenova/transformers.js)
- UI components styled with [TailwindCSS](https://tailwindcss.com/)

---

**Contract Hub** - Making contract management intelligent and automated
