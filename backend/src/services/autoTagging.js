import metadataExtraction from './metadataExtraction.js';
import { PresalesDocument, Category, Tag, DocumentCategory, DocumentTag } from '../models/index.js';

/**
 * Auto-Tagging and Categorization Service
 * Automatically tags and categorizes presales documents using AI
 */
class AutoTaggingService {
  /**
   * Process a document: extract metadata, tags, and categories
   * @param {string} documentId - Document ID
   * @param {string} documentText - Full document text
   * @param {string} documentType - Document type
   * @returns {Object} Processing result
   */
  async processDocument(documentId, documentText, documentType) {
    try {
      console.log(`🔍 Processing document ${documentId} for auto-tagging...`);

      // Step 1: Extract metadata
      const metadata = await metadataExtraction.extractMetadata(documentText, documentType);
      console.log(`✅ Metadata extracted with confidence: ${metadata.confidence}`);

      // Step 2: Update document with extracted metadata
      await this.updateDocumentMetadata(documentId, metadata);

      // Step 3: Extract and apply tags
      const tags = await metadataExtraction.extractTags(documentText);
      const appliedTags = await this.applyTags(documentId, tags, metadata.confidence);
      console.log(`✅ Applied ${appliedTags.length} tags`);

      // Step 4: Suggest and apply categories
      const suggestedCategories = metadataExtraction.suggestCategories(metadata);
      const appliedCategories = await this.applyCategories(documentId, suggestedCategories);
      console.log(`✅ Applied ${appliedCategories.length} categories`);

      // Step 5: Extract client context
      const clientContext = await metadataExtraction.extractClientContext(documentText);

      return {
        success: true,
        metadata,
        tags: appliedTags,
        categories: appliedCategories,
        clientContext,
        confidence: metadata.confidence
      };
    } catch (error) {
      console.error('Error in auto-tagging:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update document with extracted metadata
   */
  async updateDocumentMetadata(documentId, metadata) {
    const updateData = {
      client_name: metadata.client_name,
      industry: metadata.industry,
      project_value: metadata.project_value,
      project_duration: metadata.project_duration,
      outcomes: metadata.outcomes,
      challenges: metadata.challenges,
      solutions: metadata.solutions,
      technologies: metadata.technologies.join(', '),
      metadata: JSON.stringify({
        domain: metadata.domain,
        service_line: metadata.service_line,
        key_metrics: metadata.key_metrics,
        region: metadata.region,
        confidence: metadata.confidence
      })
    };

    return PresalesDocument.update(documentId, updateData);
  }

  /**
   * Apply tags to document
   */
  async applyTags(documentId, tagNames, confidence = 0.8) {
    const appliedTags = [];

    for (const tagName of tagNames) {
      if (!tagName || tagName.trim().length === 0) continue;

      try {
        // Find or create tag
        const tag = Tag.findOrCreate(tagName.trim().toLowerCase(), 'custom');

        // Check if already tagged
        const existing = DocumentTag.findAll({ document_id: documentId, tag_id: tag.id });
        if (existing.length > 0) continue;

        // Add tag to document
        DocumentTag.addTag(documentId, tag.id, confidence, true);
        appliedTags.push(tag);
      } catch (error) {
        console.error(`Error applying tag ${tagName}:`, error);
      }
    }

    return appliedTags;
  }

  /**
   * Apply categories to document
   */
  async applyCategories(documentId, suggestedCategories) {
    const appliedCategories = [];

    for (const suggestion of suggestedCategories) {
      if (!suggestion.name) continue;

      try {
        // Find or create category
        let category = this.findCategoryByName(suggestion.name, suggestion.type);

        if (!category) {
          category = Category.create({
            name: suggestion.name,
            type: suggestion.type,
            description: `Auto-generated ${suggestion.type} category`
          });
        }

        // Check if already categorized
        const existing = DocumentCategory.findAll({
          document_id: documentId,
          category_id: category.id
        });

        if (existing.length > 0) continue;

        // Add category to document
        DocumentCategory.addCategory(
          documentId,
          category.id,
          suggestion.confidence,
          true
        );

        appliedCategories.push(category);
      } catch (error) {
        console.error(`Error applying category ${suggestion.name}:`, error);
      }
    }

    return appliedCategories;
  }

  /**
   * Find category by name and type
   */
  findCategoryByName(name, type) {
    const categories = Category.findByType(type);
    return categories.find(c => c.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Re-tag a document (remove old auto-generated tags/categories and apply new ones)
   */
  async retagDocument(documentId, documentText, documentType) {
    try {
      // Remove old auto-generated tags
      this.removeAutoGeneratedTags(documentId);

      // Remove old auto-generated categories
      this.removeAutoGeneratedCategories(documentId);

      // Process document again
      return await this.processDocument(documentId, documentText, documentType);
    } catch (error) {
      console.error('Error re-tagging document:', error);
      throw error;
    }
  }

  /**
   * Remove auto-generated tags from document
   */
  removeAutoGeneratedTags(documentId) {
    const tags = DocumentTag.findAll({ document_id: documentId });

    for (const docTag of tags) {
      if (docTag.auto_generated === 1) {
        DocumentTag.delete(docTag.id);
      }
    }
  }

  /**
   * Remove auto-generated categories from document
   */
  removeAutoGeneratedCategories(documentId) {
    const categories = DocumentCategory.findAll({ document_id: documentId });

    for (const docCat of categories) {
      if (docCat.auto_generated === 1) {
        DocumentCategory.delete(docCat.id);
      }
    }
  }

  /**
   * Bulk process multiple documents
   */
  async bulkProcessDocuments(documents) {
    const results = [];

    for (const doc of documents) {
      try {
        const result = await this.processDocument(doc.id, doc.content, doc.document_type);
        results.push({
          documentId: doc.id,
          ...result
        });

        // Add small delay to avoid overwhelming the LLM
        await this.sleep(1000);
      } catch (error) {
        results.push({
          documentId: doc.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get tagging statistics for a document
   */
  getDocumentTaggingStats(documentId) {
    const doc = PresalesDocument.getWithCategoriesAndTags(documentId);

    if (!doc) return null;

    const autoTags = doc.tags.filter(t => t.auto_generated === 1);
    const manualTags = doc.tags.filter(t => t.auto_generated === 0);
    const autoCategories = doc.categories.filter(c => c.auto_generated === 1);
    const manualCategories = doc.categories.filter(c => c.auto_generated === 0);

    return {
      total_tags: doc.tags.length,
      auto_tags: autoTags.length,
      manual_tags: manualTags.length,
      total_categories: doc.categories.length,
      auto_categories: autoCategories.length,
      manual_categories: manualCategories.length,
      metadata: doc.metadata ? JSON.parse(doc.metadata) : null
    };
  }

  /**
   * Initialize default categories
   */
  async initializeDefaultCategories() {
    const defaultCategories = [
      // Industries
      { name: 'Healthcare', type: 'industry' },
      { name: 'Finance', type: 'industry' },
      { name: 'Retail', type: 'industry' },
      { name: 'Technology', type: 'industry' },
      { name: 'Manufacturing', type: 'industry' },
      { name: 'Energy', type: 'industry' },
      { name: 'Telecommunications', type: 'industry' },
      { name: 'Education', type: 'industry' },
      { name: 'Government', type: 'industry' },
      { name: 'Insurance', type: 'industry' },

      // Service Lines
      { name: 'Cloud Migration', type: 'service_line' },
      { name: 'Application Development', type: 'service_line' },
      { name: 'Data Analytics', type: 'service_line' },
      { name: 'AI/ML', type: 'service_line' },
      { name: 'Consulting', type: 'service_line' },
      { name: 'DevOps', type: 'service_line' },
      { name: 'Infrastructure', type: 'service_line' },
      { name: 'Security', type: 'service_line' },
      { name: 'Quality Assurance', type: 'service_line' },

      // Domains
      { name: 'E-commerce', type: 'domain' },
      { name: 'Supply Chain', type: 'domain' },
      { name: 'CRM', type: 'domain' },
      { name: 'ERP', type: 'domain' },
      { name: 'Analytics', type: 'domain' },
      { name: 'Mobile', type: 'domain' },
      { name: 'Web', type: 'domain' },

      // Technologies
      { name: 'AWS', type: 'technology' },
      { name: 'Azure', type: 'technology' },
      { name: 'Google Cloud', type: 'technology' },
      { name: 'React', type: 'technology' },
      { name: 'Node.js', type: 'technology' },
      { name: 'Python', type: 'technology' },
      { name: 'Java', type: 'technology' },
      { name: 'Salesforce', type: 'technology' },

      // Regions
      { name: 'North America', type: 'region' },
      { name: 'Europe', type: 'region' },
      { name: 'Asia Pacific', type: 'region' },
      { name: 'Latin America', type: 'region' },
      { name: 'Middle East', type: 'region' }
    ];

    for (const cat of defaultCategories) {
      const existing = this.findCategoryByName(cat.name, cat.type);
      if (!existing) {
        Category.create({
          name: cat.name,
          type: cat.type,
          description: `Standard ${cat.type} category`
        });
      }
    }

    console.log('✅ Default categories initialized');
  }

  /**
   * Helper: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new AutoTaggingService();
