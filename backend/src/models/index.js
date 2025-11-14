import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// Base Model class with common CRUD operations
class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  create(data) {
    const id = data.id || uuidv4();
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const stmt = db.prepare(`
      INSERT INTO ${this.tableName} (id, ${columns})
      VALUES (?, ${placeholders})
    `);

    stmt.run(id, ...values);
    return this.findById(id);
  }

  findById(id) {
    const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    return stmt.get(id);
  }

  findAll(filters = {}, limit = 100, offset = 0) {
    let query = `SELECT * FROM ${this.tableName}`;
    const params = [];

    if (Object.keys(filters).length > 0) {
      const conditions = Object.keys(filters).map(key => `${key} = ?`);
      query += ` WHERE ${conditions.join(' AND ')}`;
      params.push(...Object.values(filters));
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  update(id, data) {
    data.updated_at = new Date().toISOString();
    const sets = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];

    const stmt = db.prepare(`
      UPDATE ${this.tableName}
      SET ${sets}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  delete(id) {
    const stmt = db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    return stmt.run(id);
  }

  count(filters = {}) {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params = [];

    if (Object.keys(filters).length > 0) {
      const conditions = Object.keys(filters).map(key => `${key} = ?`);
      query += ` WHERE ${conditions.join(' AND ')}`;
      params.push(...Object.values(filters));
    }

    const stmt = db.prepare(query);
    return stmt.get(...params).count;
  }
}

// User Model
export class UserModel extends BaseModel {
  constructor() {
    super('users');
  }

  findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }
}

// Template Model
export class TemplateModel extends BaseModel {
  constructor() {
    super('templates');
  }

  findActive(contractType = null) {
    let query = 'SELECT * FROM templates WHERE is_active = 1';
    const params = [];

    if (contractType) {
      query += ' AND contract_type = ?';
      params.push(contractType);
    }

    query += ' ORDER BY created_at DESC';
    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  approve(id, approvedBy) {
    const stmt = db.prepare(`
      UPDATE templates
      SET approved_by = ?, approved_at = ?
      WHERE id = ?
    `);
    stmt.run(approvedBy, new Date().toISOString(), id);
    return this.findById(id);
  }
}

// Proposal Model
export class ProposalModel extends BaseModel {
  constructor() {
    super('proposals');
  }

  findByClient(clientName) {
    const stmt = db.prepare('SELECT * FROM proposals WHERE client_name LIKE ? ORDER BY created_at DESC');
    return stmt.all(`%${clientName}%`);
  }
}

// Contract Model
export class ContractModel extends BaseModel {
  constructor() {
    super('contracts');
  }

  findByStatus(status) {
    const stmt = db.prepare('SELECT * FROM contracts WHERE status = ? ORDER BY created_at DESC');
    return stmt.all(status);
  }

  findByProposal(proposalId) {
    const stmt = db.prepare('SELECT * FROM contracts WHERE proposal_id = ?');
    return stmt.all(proposalId);
  }

  updateStatus(id, status, userId) {
    const stmt = db.prepare(`
      UPDATE contracts
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, new Date().toISOString(), id);
    return this.findById(id);
  }

  generateContractNumber() {
    const year = new Date().getFullYear();
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM contracts
      WHERE contract_number LIKE ?
    `);
    const count = stmt.get(`CNT-${year}-%`).count;
    return `CNT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

// Validation Result Model
export class ValidationResultModel extends BaseModel {
  constructor() {
    super('validation_results');
  }

  findByContract(contractId) {
    const stmt = db.prepare('SELECT * FROM validation_results WHERE contract_id = ? ORDER BY created_at DESC');
    return stmt.all(contractId);
  }

  getLatestByContract(contractId) {
    const stmt = db.prepare(`
      SELECT * FROM validation_results
      WHERE contract_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return stmt.get(contractId);
  }
}

// Audit Log Model
export class AuditLogModel extends BaseModel {
  constructor() {
    super('audit_logs');
  }

  log(entityType, entityId, action, changes, userId, metadata = {}) {
    const data = {
      id: uuidv4(),
      entity_type: entityType,
      entity_id: entityId,
      action,
      changes: JSON.stringify(changes),
      user_id: userId,
      ip_address: metadata.ip || null,
      user_agent: metadata.userAgent || null,
    };

    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, changes, user_id, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.entity_type,
      data.entity_id,
      data.action,
      data.changes,
      data.user_id,
      data.ip_address,
      data.user_agent
    );

    return this.findById(data.id);
  }

  findByEntity(entityType, entityId) {
    const stmt = db.prepare(`
      SELECT * FROM audit_logs
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(entityType, entityId);
  }
}

// Document Model
export class DocumentModel extends BaseModel {
  constructor() {
    super('documents');
  }

  updateEmbeddingStatus(id, status, chunkCount = 0) {
    const stmt = db.prepare(`
      UPDATE documents
      SET embedding_status = ?, chunk_count = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, chunkCount, new Date().toISOString(), id);
    return this.findById(id);
  }

  findByEmbeddingStatus(status) {
    const stmt = db.prepare('SELECT * FROM documents WHERE embedding_status = ?');
    return stmt.all(status);
  }
}

// ========================================
// PRESALES KNOWLEDGE HUB MODELS
// ========================================

// Presales Document Model
export class PresalesDocumentModel extends BaseModel {
  constructor() {
    super('presales_documents');
  }

  findByType(documentType) {
    const stmt = db.prepare('SELECT * FROM presales_documents WHERE document_type = ? ORDER BY created_at DESC');
    return stmt.all(documentType);
  }

  findByClient(clientName) {
    const stmt = db.prepare('SELECT * FROM presales_documents WHERE client_name LIKE ? ORDER BY created_at DESC');
    return stmt.all(`%${clientName}%`);
  }

  findByIndustry(industry) {
    const stmt = db.prepare('SELECT * FROM presales_documents WHERE industry = ? ORDER BY created_at DESC');
    return stmt.all(industry);
  }

  updateEmbeddingStatus(id, status, chunkCount = 0) {
    const stmt = db.prepare(`
      UPDATE presales_documents
      SET embedding_status = ?, chunk_count = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, chunkCount, new Date().toISOString(), id);
    return this.findById(id);
  }

  updateSummary(id, summary) {
    const stmt = db.prepare(`
      UPDATE presales_documents
      SET summary = ?, summary_generated_at = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(summary, new Date().toISOString(), new Date().toISOString(), id);
    return this.findById(id);
  }

  search(query, filters = {}) {
    let sql = 'SELECT * FROM presales_documents WHERE 1=1';
    const params = [];

    if (query) {
      sql += ' AND (title LIKE ? OR description LIKE ? OR content LIKE ?)';
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.document_type) {
      sql += ' AND document_type = ?';
      params.push(filters.document_type);
    }

    if (filters.industry) {
      sql += ' AND industry = ?';
      params.push(filters.industry);
    }

    if (filters.client_name) {
      sql += ' AND client_name LIKE ?';
      params.push(`%${filters.client_name}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT 50';

    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }

  getWithCategoriesAndTags(id) {
    const doc = this.findById(id);
    if (!doc) return null;

    // Get categories
    const categoryStmt = db.prepare(`
      SELECT c.* FROM categories c
      INNER JOIN document_categories dc ON c.id = dc.category_id
      WHERE dc.document_id = ?
    `);
    doc.categories = categoryStmt.all(id);

    // Get tags
    const tagStmt = db.prepare(`
      SELECT t.* FROM tags t
      INNER JOIN document_tags dt ON t.id = dt.tag_id
      WHERE dt.document_id = ?
    `);
    doc.tags = tagStmt.all(id);

    return doc;
  }
}

// Category Model
export class CategoryModel extends BaseModel {
  constructor() {
    super('categories');
  }

  findByType(type) {
    const stmt = db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY name');
    return stmt.all(type);
  }

  findByParent(parentId) {
    const stmt = db.prepare('SELECT * FROM categories WHERE parent_id = ? ORDER BY name');
    return stmt.all(parentId);
  }

  findRootCategories(type = null) {
    let sql = 'SELECT * FROM categories WHERE parent_id IS NULL';
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY name';
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }

  getHierarchy(categoryId) {
    const category = this.findById(categoryId);
    if (!category) return null;

    // Get children
    const children = this.findByParent(categoryId);
    category.children = children;

    // Get parent if exists
    if (category.parent_id) {
      category.parent = this.findById(category.parent_id);
    }

    return category;
  }
}

// Tag Model
export class TagModel extends BaseModel {
  constructor() {
    super('tags');
  }

  findByType(type) {
    const stmt = db.prepare('SELECT * FROM tags WHERE type = ? ORDER BY name');
    return stmt.all(type);
  }

  findByName(name) {
    const stmt = db.prepare('SELECT * FROM tags WHERE name = ?');
    return stmt.get(name);
  }

  findOrCreate(name, type = 'custom') {
    let tag = this.findByName(name);
    if (!tag) {
      tag = this.create({ name, type });
    }
    return tag;
  }

  getPopularTags(limit = 20) {
    const stmt = db.prepare(`
      SELECT t.*, COUNT(dt.document_id) as usage_count
      FROM tags t
      LEFT JOIN document_tags dt ON t.id = dt.tag_id
      GROUP BY t.id
      ORDER BY usage_count DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
}

// Document-Category Relationship Model
export class DocumentCategoryModel extends BaseModel {
  constructor() {
    super('document_categories');
  }

  addCategory(documentId, categoryId, confidence = 1.0, autoGenerated = false) {
    const data = {
      document_id: documentId,
      category_id: categoryId,
      confidence,
      auto_generated: autoGenerated ? 1 : 0
    };
    return this.create(data);
  }

  removeCategory(documentId, categoryId) {
    const stmt = db.prepare(`
      DELETE FROM document_categories
      WHERE document_id = ? AND category_id = ?
    `);
    return stmt.run(documentId, categoryId);
  }

  getCategoriesByDocument(documentId) {
    const stmt = db.prepare(`
      SELECT c.*, dc.confidence, dc.auto_generated
      FROM categories c
      INNER JOIN document_categories dc ON c.id = dc.category_id
      WHERE dc.document_id = ?
    `);
    return stmt.all(documentId);
  }

  getDocumentsByCategory(categoryId) {
    const stmt = db.prepare(`
      SELECT pd.*, dc.confidence
      FROM presales_documents pd
      INNER JOIN document_categories dc ON pd.id = dc.document_id
      WHERE dc.category_id = ?
      ORDER BY pd.created_at DESC
    `);
    return stmt.all(categoryId);
  }
}

// Document-Tag Relationship Model
export class DocumentTagModel extends BaseModel {
  constructor() {
    super('document_tags');
  }

  addTag(documentId, tagId, confidence = 1.0, autoGenerated = false) {
    const data = {
      document_id: documentId,
      tag_id: tagId,
      confidence,
      auto_generated: autoGenerated ? 1 : 0
    };
    return this.create(data);
  }

  removeTag(documentId, tagId) {
    const stmt = db.prepare(`
      DELETE FROM document_tags
      WHERE document_id = ? AND tag_id = ?
    `);
    return stmt.run(documentId, tagId);
  }

  getTagsByDocument(documentId) {
    const stmt = db.prepare(`
      SELECT t.*, dt.confidence, dt.auto_generated
      FROM tags t
      INNER JOIN document_tags dt ON t.id = dt.tag_id
      WHERE dt.document_id = ?
    `);
    return stmt.all(documentId);
  }

  getDocumentsByTag(tagId) {
    const stmt = db.prepare(`
      SELECT pd.*, dt.confidence
      FROM presales_documents pd
      INNER JOIN document_tags dt ON pd.id = dt.document_id
      WHERE dt.tag_id = ?
      ORDER BY pd.created_at DESC
    `);
    return stmt.all(tagId);
  }
}

// Export model instances
export const User = new UserModel();
export const Template = new TemplateModel();
export const Proposal = new ProposalModel();
export const Contract = new ContractModel();
export const ValidationResult = new ValidationResultModel();
export const AuditLog = new AuditLogModel();
export const Document = new DocumentModel();

// Presales models
export const PresalesDocument = new PresalesDocumentModel();
export const Category = new CategoryModel();
export const Tag = new TagModel();
export const DocumentCategory = new DocumentCategoryModel();
export const DocumentTag = new DocumentTagModel();
