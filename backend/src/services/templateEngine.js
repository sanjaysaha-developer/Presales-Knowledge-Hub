import Handlebars from 'handlebars';
import { Template } from '../models/index.js';

/**
 * Template Engine Service
 * Manages contract templates with placeholders and conditional logic
 */
class TemplateEngine {
  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  registerHelpers() {
    // Currency formatter
    this.handlebars.registerHelper('currency', function (amount, currency = 'USD') {
      return `${currency} ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });

    // Date formatter
    this.handlebars.registerHelper('date', function (dateStr) {
      if (!dateStr) return 'TBD';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Conditional helper for complex logic
    this.handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&':
          return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||':
          return v1 || v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    // List formatter
    this.handlebars.registerHelper('list', function (items) {
      if (!items) return '';
      const itemArray = typeof items === 'string' ? items.split(',') : items;
      return itemArray.map((item, idx) => `${idx + 1}. ${item.trim()}`).join('\n');
    });
  }

  /**
   * Render a template with data
   * @param {object} template - Template object from database
   * @param {object} data - Data to fill the template
   * @returns {string}
   */
  render(template, data) {
    try {
      const compiled = this.handlebars.compile(template.content);

      // Prepare template data
      const templateData = {
        ...data,
        currentDate: new Date().toISOString().split('T')[0],
        currentYear: new Date().getFullYear(),
      };

      const result = compiled(templateData);
      return this.cleanOutput(result);
    } catch (error) {
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * Clean the rendered output
   */
  cleanOutput(text) {
    return text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t/g, '  ')
      .trim();
  }

  /**
   * Extract placeholders from a template
   * @param {string} templateContent - Template content
   * @returns {Array<string>}
   */
  extractPlaceholders(templateContent) {
    const placeholders = new Set();

    // Match {{variableName}} patterns
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(templateContent)) !== null) {
      const placeholder = match[1].trim();

      // Filter out handlebars keywords and helpers
      if (!['if', 'else', 'each', 'with', 'unless', '#', '/', '^'].some(kw => placeholder.startsWith(kw))) {
        placeholders.add(placeholder);
      }
    }

    return Array.from(placeholders);
  }

  /**
   * Validate that all required placeholders have values
   * @param {object} template - Template object
   * @param {object} data - Data object
   * @returns {{valid: boolean, missing: Array<string>}}
   */
  validateData(template, data) {
    const placeholders = this.extractPlaceholders(template.content);

    // Parse template placeholders if stored as JSON
    let requiredFields = [];
    if (template.placeholders) {
      try {
        const parsed = typeof template.placeholders === 'string'
          ? JSON.parse(template.placeholders)
          : template.placeholders;

        requiredFields = parsed.filter(p => p.required).map(p => p.name);
      } catch (error) {
        // If parsing fails, use all extracted placeholders as required
        requiredFields = placeholders;
      }
    } else {
      requiredFields = placeholders;
    }

    const missing = requiredFields.filter(field => !data[field]);

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Create a new template
   * @param {object} templateData - Template data
   * @param {string} userId - User ID creating the template
   * @returns {object}
   */
  createTemplate(templateData, userId) {
    // Extract placeholders from content
    const placeholders = this.extractPlaceholders(templateData.content);

    // Create placeholder metadata
    const placeholderMeta = placeholders.map(name => ({
      name,
      type: this.guessPlaceholderType(name),
      required: true,
    }));

    const template = Template.create({
      ...templateData,
      placeholders: JSON.stringify(placeholderMeta),
      created_by: userId,
      is_active: 1,
    });

    return template;
  }

  /**
   * Guess the type of a placeholder based on its name
   */
  guessPlaceholderType(name) {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('date')) return 'date';
    if (lowerName.includes('price') || lowerName.includes('amount') || lowerName.includes('fee')) return 'number';
    if (lowerName.includes('email')) return 'email';
    if (lowerName.includes('phone')) return 'phone';
    if (lowerName.includes('address')) return 'address';
    if (lowerName.includes('description') || lowerName.includes('scope') || lowerName.includes('terms')) return 'textarea';

    return 'text';
  }

  /**
   * Preview a template with sample data
   * @param {object} template - Template object
   * @returns {string}
   */
  previewTemplate(template) {
    const placeholders = this.extractPlaceholders(template.content);

    // Generate sample data
    const sampleData = {};
    for (const placeholder of placeholders) {
      sampleData[placeholder] = `[${placeholder}]`;
    }

    return this.render(template, sampleData);
  }

  /**
   * Get template by ID and render with data
   * @param {string} templateId - Template ID
   * @param {object} data - Data to render
   * @returns {string}
   */
  async renderById(templateId, data) {
    const template = Template.findById(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (!template.is_active) {
      throw new Error(`Template is not active: ${templateId}`);
    }

    // Validate data
    const validation = this.validateData(template, data);
    if (!validation.valid) {
      throw new Error(`Missing required fields: ${validation.missing.join(', ')}`);
    }

    return this.render(template, data);
  }
}

export default new TemplateEngine();
