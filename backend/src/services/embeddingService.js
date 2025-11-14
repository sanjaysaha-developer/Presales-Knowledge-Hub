import { ChromaClient } from 'chromadb';
import { pipeline } from '@xenova/transformers';

/**
 * Embedding and Vector Store Service
 * Handles text embeddings and vector similarity search using ChromaDB
 */
class EmbeddingService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.embedder = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the embedding service
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize ChromaDB client
      this.client = new ChromaClient({
        path: process.env.CHROMA_PATH || './data/chroma_db',
      });

      // Get or create collection
      const collectionName = process.env.CHROMA_COLLECTION_NAME || 'contracts_knowledge';

      try {
        this.collection = await this.client.getCollection({ name: collectionName });
        console.log(`✅ Connected to existing collection: ${collectionName}`);
      } catch (error) {
        this.collection = await this.client.createCollection({
          name: collectionName,
          metadata: { description: 'Contract knowledge base for RAG' },
        });
        console.log(`✅ Created new collection: ${collectionName}`);
      }

      // Initialize embedding model (using all-MiniLM-L6-v2)
      console.log('🔄 Loading embedding model...');
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );
      console.log('✅ Embedding model loaded');

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize embedding service:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for text
   * @param {string|string[]} texts - Text or array of texts to embed
   * @returns {Promise<number[]|number[][]>}
   */
  async generateEmbeddings(texts) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const isArray = Array.isArray(texts);
      const inputTexts = isArray ? texts : [texts];

      const embeddings = [];

      for (const text of inputTexts) {
        const output = await this.embedder(text, {
          pooling: 'mean',
          normalize: true,
        });

        // Convert tensor to array
        const embedding = Array.from(output.data);
        embeddings.push(embedding);
      }

      return isArray ? embeddings : embeddings[0];
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      throw error;
    }
  }

  /**
   * Add documents to the vector store
   * @param {Array} documents - Array of {id, text, metadata}
   */
  async addDocuments(documents) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const ids = documents.map(doc => doc.id);
      const texts = documents.map(doc => doc.text);
      const metadatas = documents.map(doc => doc.metadata || {});

      // Generate embeddings
      const embeddings = await this.generateEmbeddings(texts);

      // Add to ChromaDB
      await this.collection.add({
        ids,
        embeddings,
        documents: texts,
        metadatas,
      });

      console.log(`✅ Added ${documents.length} documents to vector store`);
      return { success: true, count: documents.length };
    } catch (error) {
      console.error('Failed to add documents:', error);
      throw error;
    }
  }

  /**
   * Search for similar documents
   * @param {string} query - Search query
   * @param {number} topK - Number of results to return
   * @param {object} filter - Metadata filters
   * @returns {Promise<Array>}
   */
  async search(query, topK = 5, filter = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbeddings(query);

      // Search in ChromaDB
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: filter,
      });

      // Format results
      const formattedResults = [];
      if (results.ids && results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          formattedResults.push({
            id: results.ids[0][i],
            text: results.documents[0][i],
            metadata: results.metadatas[0][i],
            distance: results.distances[0][i],
            similarity: 1 - results.distances[0][i], // Convert distance to similarity
          });
        }
      }

      return formattedResults;
    } catch (error) {
      console.error('Failed to search:', error);
      throw error;
    }
  }

  /**
   * Delete documents from the vector store
   * @param {string[]} ids - Document IDs to delete
   */
  async deleteDocuments(ids) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.collection.delete({ ids });
      console.log(`✅ Deleted ${ids.length} documents from vector store`);
      return { success: true, count: ids.length };
    } catch (error) {
      console.error('Failed to delete documents:', error);
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {string} id - Document ID
   */
  async getDocument(id) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const result = await this.collection.get({ ids: [id] });

      if (result.ids.length === 0) {
        return null;
      }

      return {
        id: result.ids[0],
        text: result.documents[0],
        metadata: result.metadatas[0],
      };
    } catch (error) {
      console.error('Failed to get document:', error);
      throw error;
    }
  }

  /**
   * Count documents in collection
   */
  async count() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const result = await this.collection.count();
      return result;
    } catch (error) {
      console.error('Failed to count documents:', error);
      throw error;
    }
  }

  /**
   * Clear all documents from the collection
   */
  async clearCollection() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const collectionName = process.env.CHROMA_COLLECTION_NAME || 'contracts_knowledge';
      await this.client.deleteCollection({ name: collectionName });
      this.collection = await this.client.createCollection({
        name: collectionName,
        metadata: { description: 'Contract knowledge base for RAG' },
      });
      console.log('✅ Collection cleared');
      return { success: true };
    } catch (error) {
      console.error('Failed to clear collection:', error);
      throw error;
    }
  }
}

export default new EmbeddingService();
