import embeddingService from './embeddingService.js';
import { PresalesDocument, DocumentCategory, DocumentTag } from '../models/index.js';
import documentProcessor from './documentProcessor.js';

/**
 * Presales Semantic Search Service
 * Provides semantic search capabilities for presales documents
 */
class PresalesSearchService {
  constructor() {
    this.collectionName = 'presales_knowledge';
  }

  /**
   * Initialize the presales search collection
   */
  async initialize() {
    try {
      await embeddingService.initialize();
      console.log('✅ Presales search service initialized');
    } catch (error) {
      console.error('Error initializing presales search:', error);
      throw error;
    }
  }

  /**
   * Index a presales document for semantic search
   * @param {Object} document - Presales document object
   * @param {string} filePath - Path to document file
   */
  async indexDocument(document, filePath) {
    try {
      console.log(`📑 Indexing presales document: ${document.title}`);

      // Update status to processing
      PresalesDocument.updateEmbeddingStatus(document.id, 'processing');

      // Process document if content not already extracted
      let content = document.content;
      if (!content && filePath) {
        const processed = await documentProcessor.processDocument(filePath);
        content = processed.text;

        // Update document with extracted content
        PresalesDocument.update(document.id, { content });
      }

      if (!content) {
        throw new Error('No content available for indexing');
      }

      // Chunk the document
      const chunks = documentProcessor.chunkText(content, 800, 200);

      // Prepare documents for embedding
      const documents = chunks.map((chunk, index) => ({
        id: `presales_${document.id}_chunk_${index}`,
        text: chunk.text,
        metadata: {
          document_id: document.id,
          document_type: document.document_type,
          title: document.title,
          client_name: document.client_name,
          industry: document.industry,
          chunk_index: index,
          total_chunks: chunks.length,
          source: 'presales'
        }
      }));

      // Add to vector store
      await embeddingService.addDocuments(documents);

      // Update embedding status
      PresalesDocument.updateEmbeddingStatus(document.id, 'completed', chunks.length);

      console.log(`✅ Indexed ${chunks.length} chunks for document: ${document.title}`);

      return {
        success: true,
        chunks: chunks.length
      };
    } catch (error) {
      console.error('Error indexing document:', error);
      PresalesDocument.updateEmbeddingStatus(document.id, 'failed');
      throw error;
    }
  }

  /**
   * Semantic search across presales documents
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @param {number} topK - Number of results to return
   * @returns {Array} Search results
   */
  async search(query, filters = {}, topK = 10) {
    try {
      console.log(`🔍 Searching presales: "${query}"`);

      // Build metadata filter for vector search
      const metadataFilter = this.buildMetadataFilter(filters);

      // Perform semantic search
      const results = await embeddingService.search(query, topK * 2, metadataFilter);

      // Filter results to only presales documents
      const presalesResults = results.filter(r => r.metadata?.source === 'presales');

      // Group chunks by document and aggregate scores
      const groupedResults = this.groupChunksByDocument(presalesResults.slice(0, topK));

      // Enrich results with full document data
      const enrichedResults = this.enrichResults(groupedResults);

      console.log(`✅ Found ${enrichedResults.length} relevant documents`);

      return enrichedResults;
    } catch (error) {
      console.error('Error in presales search:', error);
      throw error;
    }
  }

  /**
   * Search for case studies matching specific criteria
   */
  async searchCaseStudies(query, filters = {}) {
    filters.document_type = 'case_study';
    return await this.search(query, filters, 5);
  }

  /**
   * Search for proposal snippets
   */
  async searchProposalSnippets(query, filters = {}) {
    filters.document_type = 'proposal_template';
    const results = await this.search(query, filters, 10);

    // Return actual chunks with their text
    return results.map(result => ({
      ...result,
      snippet: result.matching_chunks[0]?.text || '',
      relevance: result.average_similarity
    }));
  }

  /**
   * Find similar documents
   */
  async findSimilarDocuments(documentId, topK = 5) {
    try {
      const document = PresalesDocument.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Use document content or description as query
      const query = document.description || document.title;

      // Search but exclude the source document
      const results = await this.search(query, {}, topK + 1);

      // Filter out the source document
      return results.filter(r => r.document_id !== documentId).slice(0, topK);
    } catch (error) {
      console.error('Error finding similar documents:', error);
      throw error;
    }
  }

  /**
   * Search by client/industry for relevant case studies
   */
  async searchByClientContext(clientName, industry, topK = 5) {
    const query = `Case studies for ${clientName || 'client'} in ${industry || 'industry'}`;

    const filters = {};
    if (industry) filters.industry = industry;

    return await this.searchCaseStudies(query, filters);
  }

  /**
   * Build metadata filter for vector search
   */
  buildMetadataFilter(filters) {
    const metadataFilter = { source: 'presales' };

    if (filters.document_type) {
      metadataFilter.document_type = filters.document_type;
    }

    if (filters.industry) {
      metadataFilter.industry = filters.industry;
    }

    if (filters.client_name) {
      metadataFilter.client_name = filters.client_name;
    }

    return metadataFilter;
  }

  /**
   * Group search result chunks by document ID
   */
  groupChunksByDocument(results) {
    const grouped = {};

    for (const result of results) {
      const docId = result.metadata.document_id;

      if (!grouped[docId]) {
        grouped[docId] = {
          document_id: docId,
          matching_chunks: [],
          max_similarity: 0,
          average_similarity: 0,
          metadata: result.metadata
        };
      }

      grouped[docId].matching_chunks.push({
        text: result.text,
        similarity: result.similarity,
        chunk_index: result.metadata.chunk_index
      });

      grouped[docId].max_similarity = Math.max(
        grouped[docId].max_similarity,
        result.similarity
      );
    }

    // Calculate average similarity for each document
    for (const docId in grouped) {
      const chunks = grouped[docId].matching_chunks;
      const avgSim = chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length;
      grouped[docId].average_similarity = avgSim;
    }

    // Convert to array and sort by max similarity
    return Object.values(grouped).sort((a, b) => b.max_similarity - a.max_similarity);
  }

  /**
   * Enrich results with full document data and tags/categories
   */
  enrichResults(groupedResults) {
    return groupedResults.map(result => {
      const doc = PresalesDocument.findById(result.document_id);

      if (!doc) return result;

      // Get categories and tags
      const categories = DocumentCategory.getCategoriesByDocument(doc.id);
      const tags = DocumentTag.getTagsByDocument(doc.id);

      return {
        ...result,
        document: {
          id: doc.id,
          title: doc.title,
          document_type: doc.document_type,
          description: doc.description,
          client_name: doc.client_name,
          industry: doc.industry,
          project_value: doc.project_value,
          outcomes: doc.outcomes,
          summary: doc.summary,
          created_at: doc.created_at
        },
        categories: categories.map(c => c.name),
        tags: tags.map(t => t.name),
        relevance_score: result.max_similarity,
        snippet: result.matching_chunks[0]?.text.substring(0, 200) + '...'
      };
    });
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSearchSuggestions(partialQuery, limit = 5) {
    // Simple implementation: return popular tags and client names
    const tags = Tag.getPopularTags(limit);
    const docs = PresalesDocument.findAll({}, limit, 0);

    const suggestions = [
      ...tags.map(t => ({ type: 'tag', value: t.name })),
      ...docs.filter(d => d.client_name).map(d => ({ type: 'client', value: d.client_name }))
    ];

    return suggestions.slice(0, limit);
  }

  /**
   * Delete document from search index
   */
  async deleteDocument(documentId) {
    try {
      const doc = PresalesDocument.findById(documentId);
      if (!doc || doc.chunk_count === 0) return;

      // Delete all chunks for this document
      const chunkIds = [];
      for (let i = 0; i < doc.chunk_count; i++) {
        chunkIds.push(`presales_${documentId}_chunk_${i}`);
      }

      await embeddingService.deleteDocuments(chunkIds);

      // Update document status
      PresalesDocument.updateEmbeddingStatus(documentId, 'pending', 0);

      console.log(`✅ Deleted ${chunkIds.length} chunks for document ${documentId}`);
    } catch (error) {
      console.error('Error deleting document from index:', error);
      throw error;
    }
  }

  /**
   * Re-index a document
   */
  async reindexDocument(documentId, filePath) {
    await this.deleteDocument(documentId);
    const doc = PresalesDocument.findById(documentId);
    return await this.indexDocument(doc, filePath);
  }

  /**
   * Get indexing statistics
   */
  getIndexStats() {
    const allDocs = PresalesDocument.findAll({}, 1000, 0);

    const stats = {
      total_documents: allDocs.length,
      indexed: allDocs.filter(d => d.embedding_status === 'completed').length,
      pending: allDocs.filter(d => d.embedding_status === 'pending').length,
      processing: allDocs.filter(d => d.embedding_status === 'processing').length,
      failed: allDocs.filter(d => d.embedding_status === 'failed').length,
      total_chunks: allDocs.reduce((sum, d) => sum + (d.chunk_count || 0), 0)
    };

    return stats;
  }
}

export default new PresalesSearchService();
