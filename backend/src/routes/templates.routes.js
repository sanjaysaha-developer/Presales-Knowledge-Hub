import express from 'express';
import { Template, AuditLog } from '../models/index.js';
import { supabase } from '../services/supabaseClient.js';
import { authenticate, authorize } from '../middleware/auth.js';
import templateEngine from '../services/templateEngine.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * GET /api/templates
 * Get all templates
 */
router.get('/', async (req, res) => {
  try {
    const { contract_type, active_only } = req.query;

    // Return mock template data when Supabase is disabled
    if (!process.env.SUPABASE_URL) {
      const mockTemplates = [
        {
          id: 'msa-template',
          name: 'Master Services Agreement',
          description: 'Standard MSA template for service engagements',
          contract_type: 'MSA',
          version: '1.0',
          is_active: 1,
          created_by: 'system',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      let templates = mockTemplates;
      if (contract_type) {
        templates = mockTemplates.filter(t => t.contract_type === contract_type);
      }
      if (active_only === 'true') {
        templates = templates.filter(t => t.is_active === 1);
      }

      return res.json({
        templates,
        total: templates.length,
      });
    }

    // Supabase path
    let query = supabase.from('templates').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (contract_type) query = query.eq('contract_type', contract_type);
    if (active_only === 'true') query = query.eq('is_active', true);
    const { data, error, count } = await query;
    if (error) throw error;
    return res.json({ templates: data || [], total: count || (data ? data.length : 0) });
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
router.get('/:id', authenticate, (req, res) => {
  try {
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
router.get('/:id/preview', authenticate, (req, res) => {
  try {
    const template = Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
      });
    }

    const preview = templateEngine.previewTemplate(template);

    res.json({
      preview,
      placeholders: templateEngine.extractPlaceholders(template.content),
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
router.post('/', authenticate, authorize('admin', 'legal'), (req, res) => {
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

    if (process.env.SUPABASE_URL) {
      const id = uuidv4();
      const row = {
        id,
        name,
        description: description || null,
        contract_type,
        version,
        content,
        conditional_clauses: conditional_clauses || null,
        created_by: req.user.id,
        is_active: true,
      };
      import('../services/supabaseClient.js').then(async ({ supabase }) => {
        const { data, error } = await supabase.from('templates').insert(row).select('*').single();
        if (error) {
          return res.status(500).json({ error: 'Failed to create template', message: error.message });
        }
        AuditLog.log('template', id, 'create', { name, contract_type, version }, req.user.id);
        return res.status(201).json(data);
      });
      return;
    }

    const template = templateEngine.createTemplate(
      {
        id: uuidv4(),
        name,
        description,
        contract_type,
        version,
        content,
        conditional_clauses: conditional_clauses ? JSON.stringify(conditional_clauses) : null,
      },
      req.user.id
    );

    // Log the action
    AuditLog.log('template', template.id, 'create', {
      name,
      contract_type,
      version,
    }, req.user.id);

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
router.put('/:id', authenticate, authorize('admin', 'legal'), (req, res) => {
  try {
    if (process.env.SUPABASE_URL) {
      const updates = { ...req.body };
      delete updates.id;
      delete updates.created_by;
      delete updates.created_at;

      // JSON fields pass-through
      if (updates.placeholders && typeof updates.placeholders === 'string') {
        try { updates.placeholders = JSON.parse(updates.placeholders); } catch {}
      }
      if (updates.conditional_clauses && typeof updates.conditional_clauses === 'string') {
        try { updates.conditional_clauses = JSON.parse(updates.conditional_clauses); } catch {}
      }

      import('../services/supabaseClient.js').then(async ({ supabase }) => {
        const { data, error } = await supabase.from('templates').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', req.params.id).select('*').single();
        if (error) {
          return res.status(500).json({ error: 'Failed to update template', message: error.message });
        }
        AuditLog.log('template', req.params.id, 'update', updates, req.user.id);
        return res.json(data);
      });
      return;
    }

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
    AuditLog.log('template', template.id, 'update', updates, req.user.id);

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
router.put('/:id/approve', authenticate, authorize('admin', 'legal'), (req, res) => {
  try {
    if (process.env.SUPABASE_URL) {
      import('../services/supabaseClient.js').then(async ({ supabase }) => {
        const { data, error } = await supabase
          .from('templates')
          .update({ approved_by: req.user.id, approved_at: new Date().toISOString() })
          .eq('id', req.params.id)
          .select('*')
          .single();
        if (error) {
          return res.status(500).json({ error: 'Failed to approve template', message: error.message });
        }
        AuditLog.log('template', req.params.id, 'approve', { approved_by: req.user.id }, req.user.id);
        return res.json(data);
      });
      return;
    }

    const template = Template.approve(req.params.id, req.user.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Log the action
    AuditLog.log('template', template.id, 'approve', {
      approved_by: req.user.id,
    }, req.user.id);

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
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  try {
    if (process.env.SUPABASE_URL) {
      import('../services/supabaseClient.js').then(async ({ supabase }) => {
        // Soft delete for parity: set is_active=false
        const { error } = await supabase.from('templates').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', req.params.id);
        if (error) {
          return res.status(500).json({ error: 'Failed to delete template', message: error.message });
        }
        AuditLog.log('template', req.params.id, 'delete', {}, req.user.id);
        return res.json({ message: 'Template deleted successfully' });
      });
      return;
    }

    const template = Template.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Soft delete - mark as inactive
    Template.update(req.params.id, { is_active: 0 });

    // Log the action
    AuditLog.log('template', template.id, 'delete', { template }, req.user.id);

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
