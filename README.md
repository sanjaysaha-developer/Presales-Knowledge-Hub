# Contract Hub - RAG-based Contract Management System with LangGraph Agents

A comprehensive enterprise contract management system powered by Retrieval-Augmented Generation (RAG) and LangGraph agents, built with Node.js, React, Google Gemini, and OpenAI for advanced AI-powered contract generation and intelligent assistance.

## Features

- **RAG-Powered Contract Generation**: Generate contracts from proposals using AI with retrieval from a knowledge base
- **LangGraph AI Agents**: Advanced multi-step reasoning agents for complex queries and analysis
- **Intelligent Contract Analysis**: Specialized agents for risk assessment, compliance checking, and clause explanation
- **Presales Strategic Advice**: AI-powered recommendations for sales opportunities and competitive positioning
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
│  │  - RAG Service (Google Gemini + Retrieval)        │    │
│  │  - LangGraph Agent (Multi-step Reasoning)         │    │
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
              ┌────────────▼──────────┬──────────────┐
              │   Google Gemini API   │ OpenAI API   │
              │   gemini-2.5-flash    │ gpt-4o-mini  │
              └───────────────────────┴──────────────┘
```

## Tech Stack

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Vector Store**: ChromaDB
- **Agent Framework**: LangGraph (@langchain/langgraph)
- **LLMs**: Google Gemini (gemini-2.5-flash) + OpenAI GPT-4o-mini
- **Embeddings**: @xenova/transformers (all-MiniLM-L6-v2)
- **Document Processing**: pdf-parse, mammoth, tesseract.js
- **Template Engine**: Handlebars

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
2. **Google Gemini API Key** - Get one from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. **OpenAI API Key** - Get one from [OpenAI Platform](https://platform.openai.com/api-keys)

### Setting up API Keys

#### Google Gemini API

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

#### OpenAI API

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
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
PORT=4000
NODE_ENV=development
API_VERSION=v1

# AI/ML Configuration (optional - mocked when not available)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# LangGraph Agent Configuration (optional - mocked when not available)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# RAG Configuration
TOP_K_RETRIEVAL=5
SIMILARITY_THRESHOLD=0.7

# Database Configuration
# SQLite (default - works out of the box)
DATABASE_URL=./data/contract_hub.db

# OR Supabase (uncomment to enable full functionality)
# SUPABASE_URL=your_supabase_project_url
# SUPABASE_KEY=your_supabase_anon_key
```

**Note**: The application works with mocked AI services when API keys are not provided, allowing full functionality for development and testing.

## Running the Application

### 1. Seed the Database

```bash
cd backend
npm run seed
```

This will create:
- 2 contract templates (MSA, SOW)
- 3 sample proposals

**Note:** Authentication has been removed. The dashboard loads directly without login.

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
http://localhost:4000
```

The API will be available with all endpoints including the new LangGraph agent endpoints.

### 6. Test Supabase Integration (Optional)

If you have Supabase configured, test the database integration:

```bash
cd backend
npm run test:supabase
```

This will run comprehensive tests for all proposal and template CRUD operations.

### 7. Test Architecture Implementations

Test both the Contract Generation (RAG Flow) and AI Assistant Chat (LangGraph Flow):

```bash
cd backend
npm run test:architectures
```

This will run comprehensive tests for:
- Contract generation with RAG retrieval
- AI assistant queries with tool usage
- Supabase integration when configured

### 8. Test LangGraph Agents

You can test the agent endpoints using curl or any HTTP client:

```bash
# Test agent health
curl http://localhost:4000/api/v1/agent/health

# Test general query (RAG flow)
curl -X POST http://localhost:4000/api/v1/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the key risks in software development contracts?"}'

# Test contract-specific query (Tool-based flow)
curl -X POST http://localhost:4000/api/v1/agent/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Tell me about contract CNT-2025-001"}'

# Test contract analysis
curl -X POST http://localhost:4000/api/v1/agent/analyze-contract \
  -H "Content-Type: application/json" \
  -d '{"contractText": "This agreement is between Company A and Company B..."}'

# Test presales advice
curl -X POST http://localhost:4000/api/v1/agent/presales-advice \
  -H "Content-Type: application/json" \
  -d '{"scenario": "Enterprise client wants custom software development", "industry": "healthcare"}'
```

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

### 5. Use LangGraph AI Agents

The system now includes advanced AI agents powered by LangGraph for intelligent assistance:

#### General Queries
Use the `/api/v1/agent/query` endpoint for general questions about contracts, legal matters, or business processes. The agent will analyze your query and route it to the appropriate specialized handler.

#### Contract Analysis
Use `/api/v1/agent/analyze-contract` for deep contract analysis. The agent can identify risks, compliance issues, and provide recommendations.

#### Presales Strategic Advice
Use `/api/v1/agent/presales-advice` to get AI-powered strategic recommendations for sales opportunities, including competitive positioning and value propositions.

#### Clause Explanation
Use `/api/v1/agent/explain-clause` to get plain-language explanations of complex contract clauses.

**Example API Usage:**
```javascript
// General contract query
const response = await fetch('/api/v1/agent/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'What are the main risks in outsourcing software development?'
  })
});

// Contract analysis
const analysis = await fetch('/api/v1/agent/analyze-contract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contractText: 'Full contract text here...',
    analysisType: 'risks' // or 'compliance', 'terms', 'full'
  })
});
```

## API Reference

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

### LangGraph Agents

```
GET    /api/v1/agent/health           # Agent service health check
POST   /api/v1/agent/query            # Process general queries through agent
POST   /api/v1/agent/analyze-contract # Specialized contract analysis
POST   /api/v1/agent/presales-advice  # Get presales strategic advice
POST   /api/v1/agent/explain-clause   # Explain contract clauses
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
│   │   │   ├── langGraphAgent.js    # LangGraph AI agents
│   │   │   ├── validationService.js # Contract validation
│   │   │   └── templateEngine.js    # Template rendering
│   │   ├── routes/
│   │   │   ├── contracts.routes.js
│   │   │   ├── proposals.routes.js
│   │   │   ├── templates.routes.js
│   │   │   └── agent.routes.js
│   │   ├── middleware/
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

### Gemini API Error

```
Error: Gemini API key not configured or invalid
```

**Solution**: Add your Gemini API key to `.env`:
```bash
GEMINI_API_KEY=your_api_key_here
```

### Network/Quota Issues

```
Error: POST https://generativelanguage.googleapis.com/... 429 Too Many Requests
```

**Solution**: Check your Gemini API quota and billing status at [Google Cloud Console](https://console.cloud.google.com/)

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

## Database Integration

The application supports both SQLite (default) and Supabase databases with automatic failover:

### SQLite (Default)
- Works out of the box, no additional setup required
- Local file-based database for development and testing
- Full CRUD operations for proposals and templates

### Supabase Integration
- Cloud-hosted PostgreSQL database
- Real-time capabilities and advanced features
- Scalable for production deployments
- All CRUD operations fully implemented

### Database Features
- **Proposals**: Full CRUD operations with JSON field support
- **Templates**: Complete template management with version control
- **Audit Logging**: All operations are logged for compliance
- **Fallback Support**: Automatic fallback to SQLite if Supabase is unavailable

### Switching Between Databases
Set the following environment variables to enable Supabase:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

If these variables are not set, the application will use SQLite automatically.

## Architecture Implementations

### Contract Generation (RAG Flow)

The contract generation follows a Retrieval-Augmented Generation (RAG) pattern:

1. **Frontend Request**: Single API call to `POST /api/v1/contracts/generate` with proposal and template IDs
2. **Backend Processing**:
   - Fetches proposal and template details from Supabase Postgres database
   - Creates vector embedding from proposal data using sentence transformers
   - Queries the knowledge base using pgvector to find the most relevant text chunks
   - Constructs detailed prompt containing template, proposal data, and retrieved chunks
   - Sends prompt to Google Gemini API for generation
   - Saves newly created contract record to contracts table in Supabase
   - Returns the generated contract with citations and metadata

**Key Components**:
- **Vector Search**: Uses `match_presales` RPC for semantic similarity search
- **Prompt Engineering**: Combines template structure with retrieved knowledge
- **Citation Tracking**: Maintains links to source documents for explainability

### AI Assistant Chat (LangGraph Flow)

The AI assistant uses LangGraph for multi-step reasoning with tool usage:

1. **Frontend Request**: Sends message to `POST /api/v1/agent/query`
2. **LangGraph Processing**:
   - **Router Node**: Analyzes user intent (rag_query, contract_analysis, presales_query, contract_query)
   - **Tool Selection**: Based on intent, selects appropriate tools:
     - `search_knowledge_base`: Vector search on Supabase pgvector for general queries
     - `get_contract_details`: Fetches specific contract data from Supabase Postgres
     - `list_contracts`: Lists available contracts with filtering
   - **Tool Execution**: Runs selected tools in parallel
   - **Response Synthesis**: Final node combines tool results using Gemini API
   - **Streaming Response**: Returns synthesized answer to frontend

**Tool Capabilities**:
- **Knowledge Base Search**: Semantic search across legal and business documents
- **Contract Data Retrieval**: Direct database queries for contract-specific information
- **Multi-Modal Reasoning**: Combines structured data with unstructured knowledge

**Supported Query Types**:
- General legal/business questions (RAG flow)
- Contract-specific inquiries (tool-based flow)
- Presales strategic advice (specialized flow)
- Contract analysis and risk assessment (specialized flow)

## LangGraph Agent Capabilities

The LangGraph agents provide the following advanced features:

### Multi-Step Reasoning
- Query analysis and intent classification
- Dynamic routing to specialized handlers
- State management across conversation turns
- Error handling and recovery

### Specialized Agents
- **RAG Agent**: Leverages existing knowledge base for contract-related queries
- **Contract Analysis Agent**: Deep analysis of contract risks, compliance, and terms
- **Presales Agent**: Strategic advice for sales opportunities and competitive positioning
- **Clause Explanation Agent**: Plain-language explanations of legal clauses

### Integration Features
- Seamless integration with existing RAG system
- Citation tracking and source attribution
- Metadata enrichment for responses
- Configurable analysis depth and focus

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
- [x] LangGraph AI agents (COMPLETED)
- [ ] Agent memory and conversation persistence
- [ ] Multi-agent collaboration workflows
- [ ] Custom agent training on domain knowledge

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

- Powered by [Google Gemini](https://ai.google.dev/) for AI contract generation
- Vector search powered by [ChromaDB](https://www.trychroma.com/)
- Embeddings by [Xenova/transformers.js](https://github.com/xenova/transformers.js)
- UI components styled with [TailwindCSS](https://tailwindcss.com/)

---

**Contract Hub** - Making contract management intelligent and automated
