import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PresalesDocument, Category, Tag, DocumentCategory, DocumentTag } from '../models/index.js';
import documentProcessor from '../services/documentProcessor.js';
import presalesSearch from '../services/presalesSearch.js';
import autoTagging from '../services/autoTagging.js';
import summarization from '../services/summarization.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'data', 'presales');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `presales-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|docx|doc|pptx|ppt|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only documents are allowed (PDF, DOCX, PPTX, TXT)'));
  }
});

// ========================================
// DOCUMENT MANAGEMENT
// ========================================

/**
 * GET /api/v1/presales/documents
 * List all presales documents
 */
router.get('/documents', async (req, res) => {
  try {
    const {
      type,
      industry,
      client,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {};
    if (type) filters.document_type = type;
    if (industry) filters.industry = industry;
    if (client) filters.client_name = client;

    const documents = PresalesDocument.findAll(filters, parseInt(limit), parseInt(offset));
    const total = PresalesDocument.count(filters);

    // Enrich with categories and tags
    const enriched = documents.map(doc => {
      const categories = DocumentCategory.getCategoriesByDocument(doc.id);
      const tags = DocumentTag.getTagsByDocument(doc.id);

      return {
        ...doc,
        categories: categories.map(c => c.name),
        tags: tags.map(t => t.name)
      };
    });

    res.json({
      documents: enriched,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * GET /api/v1/presales/documents/:id
 * Get document details
 */
router.get('/documents/:id', async (req, res) => {
  try {
    const doc = PresalesDocument.getWithCategoriesAndTags(req.params.id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ document: doc });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

/**
 * POST /api/v1/presales/documents/upload
 * Upload and process a presales document
 */
router.post('/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const {
      title,
      description,
      document_type,
      client_name,
      industry
    } = req.body;

    // Extract text from document
    const processed = await documentProcessor.processDocument(req.file.path);

    // Create document record
    const document = PresalesDocument.create({
      title: title || req.file.originalname,
      description,
      document_type: document_type || 'other',
      file_path: req.file.path,
      content: processed.text,
      client_name,
      industry,
      uploaded_by: 'system'
    });

    // Process in background: auto-tag, categorize, summarize, and index
    (async () => {
      try {
        // Auto-tag and categorize
        await autoTagging.processDocument(document.id, processed.text, document_type);

        // Generate summary
        await summarization.summarizeDocument(document.id);

        // Index for semantic search
        await presalesSearch.indexDocument(document, req.file.path);

        console.log(`✅ Document fully processed: ${document.title}`);
      } catch (error) {
        console.error('Error in background processing:', error);
      }
    })();

    res.status(201).json({
      message: 'Document uploaded successfully. Processing in background...',
      document: PresalesDocument.getWithCategoriesAndTags(document.id)
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

/**
 * PUT /api/v1/presales/documents/:id
 * Update document
 */
router.put('/documents/:id', async (req, res) => {
  try {
    const doc = PresalesDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const updated = PresalesDocument.update(req.params.id, req.body);

    res.json({
      message: 'Document updated successfully',
      document: PresalesDocument.getWithCategoriesAndTags(updated.id)
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

/**
 * DELETE /api/v1/presales/documents/:id
 * Delete document
 */
router.delete('/documents/:id', async (req, res) => {
  try {
    const doc = PresalesDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from search index
    await presalesSearch.deleteDocument(req.params.id);

    // Delete file
    if (doc.file_path && fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }

    // Delete from database
    PresalesDocument.delete(req.params.id);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ========================================
// SEARCH
// ========================================

/**
 * POST /api/v1/presales/search
 * Semantic search across presales documents
 */
router.post('/search', async (req, res) => {
  try {
    const { query, filters = {}, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await presalesSearch.search(query, filters, limit);

    res.json({
      query,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/v1/presales/search/suggestions
 * Get search suggestions
 */
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q, limit = 5 } = req.query;

    const suggestions = await presalesSearch.getSearchSuggestions(q || '', parseInt(limit));

    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

/**
 * GET /api/v1/presales/documents/:id/similar
 * Find similar documents
 */
router.get('/documents/:id/similar', async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const similar = await presalesSearch.findSimilarDocuments(
      req.params.id,
      parseInt(limit)
    );

    res.json({ similar });
  } catch (error) {
    console.error('Error finding similar documents:', error);
    res.status(500).json({ error: 'Failed to find similar documents' });
  }
});

// ========================================
// SUMMARIZATION
// ========================================

/**
 * POST /api/v1/presales/documents/:id/summarize
 * Generate summary for document
 */
router.post('/documents/:id/summarize', async (req, res) => {
  try {
    const result = await summarization.summarizeDocument(req.params.id);

    res.json(result);
  } catch (error) {
    console.error('Error summarizing document:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

/**
 * GET /api/v1/presales/documents/:id/highlights
 * Get quick highlights for RFP/client calls
 */
router.get('/documents/:id/highlights', async (req, res) => {
  try {
    const highlights = await summarization.generateQuickHighlights(req.params.id);

    res.json(highlights);
  } catch (error) {
    console.error('Error generating highlights:', error);
    res.status(500).json({ error: 'Failed to generate highlights' });
  }
});

// ========================================
// CATEGORIES & TAGS
// ========================================

/**
 * GET /api/v1/presales/categories
 * List all categories
 */
router.get('/categories', async (req, res) => {
  try {
    const { type } = req.query;

    const categories = type
      ? Category.findByType(type)
      : Category.findAll({}, 200, 0);

    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/v1/presales/categories
 * Create a category
 */
router.post('/categories', async (req, res) => {
  try {
    const { name, type, parent_id, description } = req.body;

    const category = Category.create({
      name,
      type,
      parent_id,
      description
    });

    res.status(201).json({ category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * GET /api/v1/presales/tags
 * List all tags
 */
router.get('/tags', async (req, res) => {
  try {
    const { popular } = req.query;

    const tags = popular
      ? Tag.getPopularTags(20)
      : Tag.findAll({}, 200, 0);

    res.json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

/**
 * POST /api/v1/presales/documents/:id/tags
 * Add tag to document
 */
router.post('/documents/:id/tags', async (req, res) => {
  try {
    const { tag_name } = req.body;

    const tag = Tag.findOrCreate(tag_name, 'custom');
    DocumentTag.addTag(req.params.id, tag.id, 1.0, false);

    res.json({
      message: 'Tag added successfully',
      tag
    });
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

/**
 * DELETE /api/v1/presales/documents/:id/tags/:tagId
 * Remove tag from document
 */
router.delete('/documents/:id/tags/:tagId', async (req, res) => {
  try {
    DocumentTag.removeTag(req.params.id, req.params.tagId);

    res.json({ message: 'Tag removed successfully' });
  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// ========================================
// ANALYTICS & STATS
// ========================================

/**
 * GET /api/v1/presales/stats
 * Get presales hub statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const allDocs = PresalesDocument.findAll({}, 1000, 0);

    const stats = {
      total_documents: allDocs.length,
      by_type: {
        case_study: allDocs.filter(d => d.document_type === 'case_study').length,
        deck: allDocs.filter(d => d.document_type === 'deck').length,
        proposal_template: allDocs.filter(d => d.document_type === 'proposal_template').length,
        success_story: allDocs.filter(d => d.document_type === 'success_story').length,
        other: allDocs.filter(d => !['case_study', 'deck', 'proposal_template', 'success_story'].includes(d.document_type)).length
      },
      by_industry: this.groupBy(allDocs, 'industry'),
      total_tags: Tag.count({}),
      total_categories: Category.count({}),
      indexing: presalesSearch.getIndexStats()
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Helper function
function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const val = item[key] || 'Unknown';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

export default router;
