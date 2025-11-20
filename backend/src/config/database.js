import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/contract_hub.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDatabase() {
  const schema = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'legal', 'business', 'viewer')) DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Templates table
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      contract_type TEXT NOT NULL,
      version TEXT NOT NULL,
      content TEXT NOT NULL,
      placeholders TEXT,
      conditional_clauses TEXT,
      approved_by TEXT,
      approved_at DATETIME,
      is_active INTEGER DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    -- Proposals table
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      client_name TEXT NOT NULL,
      project_scope TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      payment_terms TEXT,
      milestones TEXT,
      start_date TEXT,
      end_date TEXT,
      deliverables TEXT,
      sla_terms TEXT,
      metadata TEXT,
      file_path TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Contracts table
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      proposal_id TEXT,
      contract_number TEXT UNIQUE,
      title TEXT NOT NULL,
      party_a TEXT NOT NULL,
      party_b TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT CHECK(status IN ('draft', 'pending_review', 'approved', 'signed', 'rejected')) DEFAULT 'draft',
      effective_date TEXT,
      signed_date TEXT,
      file_path TEXT,
      generated_by TEXT,
      approved_by TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates(id),
      FOREIGN KEY (proposal_id) REFERENCES proposals(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (generated_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id)
    );

    -- Validation Results table
    CREATE TABLE IF NOT EXISTS validation_results (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      proposal_id TEXT NOT NULL,
      overall_score REAL NOT NULL,
      checks TEXT NOT NULL,
      mismatches TEXT,
      severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
      status TEXT CHECK(status IN ('pass', 'warning', 'fail')) DEFAULT 'pass',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id),
      FOREIGN KEY (proposal_id) REFERENCES proposals(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Audit Logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      changes TEXT,
      user_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Documents table (for knowledge base)
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      content TEXT,
      metadata TEXT,
      chunk_count INTEGER DEFAULT 0,
      embedding_status TEXT CHECK(embedding_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
      uploaded_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    -- ========================================
    -- PRESALES KNOWLEDGE HUB TABLES
    -- ========================================

    -- Presales Documents (case studies, decks, proposals, success stories)
    CREATE TABLE IF NOT EXISTS presales_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      document_type TEXT CHECK(document_type IN ('case_study', 'deck', 'proposal_template', 'success_story', 'white_paper', 'other')) NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      content TEXT,
      client_name TEXT,
      industry TEXT,
      project_value REAL,
      project_duration TEXT,
      outcomes TEXT,
      challenges TEXT,
      solutions TEXT,
      technologies TEXT,
      metadata TEXT,
      chunk_count INTEGER DEFAULT 0,
      embedding_status TEXT CHECK(embedding_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
      summary TEXT,
      summary_generated_at DATETIME,
      uploaded_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    -- Categories for hierarchical organization (domain, service line, etc.)
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('domain', 'service_line', 'industry', 'technology', 'region', 'other')) NOT NULL,
      parent_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );

    -- Tags for flexible categorization
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      type TEXT CHECK(type IN ('skill', 'methodology', 'tool', 'certification', 'custom')) DEFAULT 'custom',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Document-Category relationship (many-to-many)
    CREATE TABLE IF NOT EXISTS document_categories (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      auto_generated INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES presales_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(document_id, category_id)
    );

    -- Document-Tag relationship (many-to-many)
    CREATE TABLE IF NOT EXISTS document_tags (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      auto_generated INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES presales_documents(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(document_id, tag_id)
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
    CREATE INDEX IF NOT EXISTS idx_contracts_template_id ON contracts(template_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_proposal_id ON contracts(proposal_id);
    CREATE INDEX IF NOT EXISTS idx_templates_contract_type ON templates(contract_type);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

    -- Presales indexes
    CREATE INDEX IF NOT EXISTS idx_presales_documents_type ON presales_documents(document_type);
    CREATE INDEX IF NOT EXISTS idx_presales_documents_client ON presales_documents(client_name);
    CREATE INDEX IF NOT EXISTS idx_presales_documents_industry ON presales_documents(industry);
    CREATE INDEX IF NOT EXISTS idx_presales_documents_embedding_status ON presales_documents(embedding_status);
    CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
    CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
    CREATE INDEX IF NOT EXISTS idx_document_categories_doc ON document_categories(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_categories_cat ON document_categories(category_id);
    CREATE INDEX IF NOT EXISTS idx_document_tags_doc ON document_tags(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag_id);
  `;

  db.exec(schema);

  // Create system user if it doesn't exist
  const systemUser = db.prepare('SELECT id FROM users WHERE email = ?').get('system@local');
  if (!systemUser) {
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('system-user-id', 'system@local', 'system', 'System User', 'admin');
    console.log('✅ System user created');
  }

  console.log('✅ Database schema initialized');
}

export default db;
