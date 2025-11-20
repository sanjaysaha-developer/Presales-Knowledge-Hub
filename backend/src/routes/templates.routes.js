import express from 'express';
import { Template, AuditLog } from '../models/index.js';
// import { supabase } from '../services/supabaseClient.js'; // Temporarily disabled
// import templateEngine from '../services/templateEngine.js'; // Temporarily disabled
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * GET /api/templates
 * Get all templates
 */
router.get('/', async (req, res) => {
  try {
    const { contract_type, active_only } = req.query;

    // Use SQLite database only (Supabase temporarily disabled)
    const allTemplates = Template.findAll();
    console.log('All templates in DB:', allTemplates.length, allTemplates.map(t => ({ id: t.id, name: t.name, is_active: t.is_active })));

    let templates = allTemplates;
    if (contract_type) {
      templates = allTemplates.filter(t => t.contract_type === contract_type);
    }
    if (active_only === 'true') {
      templates = templates.filter(t => t.is_active === 1);
      console.log('After active_only filter:', templates.length, templates.map(t => ({ id: t.id, name: t.name, is_active: t.is_active })));
    }

    console.log('Returning templates:', templates.length);
    return res.json({
      templates,
      total: templates.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch templates',
      message: error.message,
    });
  }
});

/**
 * GET /api/templates/:id
 * Get a single template
 */
router.get('/:id', (req, res) => {
  try {
    // Use SQLite database only (Supabase temporarily disabled)
    const template = Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
      });
    }

    // Parse JSON fields
    if (template.placeholders) {
      try {
        template.placeholders = JSON.parse(template.placeholders);
      } catch (e) {}
    }
    if (template.conditional_clauses) {
      try {
        template.conditional_clauses = JSON.parse(template.conditional_clauses);
      } catch (e) {}
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch template',
      message: error.message,
    });
  }
});

/**
 * GET /api/templates/:id/preview
 * Preview a template with sample data
 */
router.get('/:id/preview', (req, res) => {
  try {
    // Use SQLite database only (Supabase temporarily disabled)
    const template = Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
      });
    }

    // Mock template preview (templateEngine disabled)
    const preview = template.content
      .replace(/{{[^}]+}}/g, '[PLACEHOLDER]');

    res.json({
      preview,
      placeholders: [], // Mock placeholders
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to preview template',
      message: error.message,
    });
  }
});

/**
 * POST /api/templates
 * Create a new template
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      contract_type,
      version,
      content,
      conditional_clauses,
    } = req.body;

    // Validation
    if (!name || !contract_type || !version || !content) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'name, contract_type, version, and content are required',
      });
    }

    // Use SQLite database only (Supabase temporarily disabled)
    const template = Template.create({
      id: uuidv4(),
      name,
      description,
      contract_type,
      version,
      content,
      placeholders: JSON.stringify([]), // Mock placeholders
      conditional_clauses: conditional_clauses ? JSON.stringify(conditional_clauses) : null,
      created_by: 'system-user-id', // Use system user ID
      is_active: 1,
    });

    // Log the action
    AuditLog.log('template', template.id, 'create', {
      name,
      contract_type,
      version,
    }, 'system-user-id');

    console.log('✅ Template created in SQLite:', template.name);
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create template',
      message: error.message,
    });
  }
});

/**
 * PUT /api/templates/:id
 * Update a template
 */
router.put('/:id', async (req, res) => {
  try {
    // Use SQLite database only (Supabase temporarily disabled)
    const template = Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const updates = { ...req.body };
    delete updates.id;
    delete updates.created_by;
    delete updates.created_at;

    // Stringify objects if needed
    if (updates.placeholders && typeof updates.placeholders === 'object') {
      updates.placeholders = JSON.stringify(updates.placeholders);
    }
    if (updates.conditional_clauses && typeof updates.conditional_clauses === 'object') {
      updates.conditional_clauses = JSON.stringify(updates.conditional_clauses);
    }

    const updatedTemplate = Template.update(req.params.id, updates);

    // Log the action
    AuditLog.log('template', template.id, 'update', updates, 'system-user-id');

    console.log('✅ Template updated in SQLite:', updatedTemplate.name);
    res.json(updatedTemplate);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update template',
      message: error.message,
    });
  }
});

/**
 * PUT /api/templates/:id/approve
 * Approve a template
 */
router.put('/:id/approve', async (req, res) => {
  try {
    // Use SQLite database only (Supabase temporarily disabled)
    const template = Template.approve(req.params.id, 'system');

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Log the action
    AuditLog.log('template', template.id, 'approve', {
      approved_by: 'system-user-id',
    }, 'system-user-id');

    console.log('✅ Template approved in SQLite:', template.name);
    res.json(template);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to approve template',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/templates/:id
 * Delete a template (soft delete - mark as inactive)
 */
router.delete('/:id', async (req, res) => {
  try {
    // Use SQLite database only (Supabase temporarily disabled)
    const template = Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Soft delete - mark as inactive
    Template.update(req.params.id, { is_active: 0 });

    // Log the action
    AuditLog.log('template', template.id, 'delete', { template }, 'system-user-id');

    console.log('✅ Template deleted (soft delete) in SQLite:', template.name);
    res.json({
      message: 'Template deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete template',
      message: error.message,
    });
  }
});

export default router;
