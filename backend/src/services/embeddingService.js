import { pipeline } from '@xenova/transformers';

/**
 * Embedding Service
 * Handles text embeddings using Transformers (no vector DB responsibilities)
 */
class EmbeddingService {
  constructor() {
    this.embedder = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the embedding service
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Initialize embedding model (using all-MiniLM-L6-v2)
      console.log('🔄 Loading embedding model...');
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );
      console.log('✅ Embedding model loaded');

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize embedding model:', error);
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
}

export default new EmbeddingService();
