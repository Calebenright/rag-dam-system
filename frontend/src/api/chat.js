import api from './axios';

export const chatApi = {
  // Get chat history for a specific conversation
  getHistory: async (clientId, conversationId = null, limit = 50) => {
    if (conversationId) {
      const { data } = await api.get(`/api/chat/${clientId}/conversations/${conversationId}`);
      return data.data;
    }
    const { data } = await api.get(`/api/chat/${clientId}`, {
      params: { limit },
    });
    return data.data;
  },

  // Get list of conversations
  getConversations: async (clientId) => {
    const { data } = await api.get(`/api/chat/${clientId}/conversations`);
    return data.data;
  },

  // Delete a specific conversation
  deleteConversation: async (clientId, conversationId) => {
    const { data } = await api.delete(`/api/chat/${clientId}/conversations/${conversationId}`);
    return data;
  },

  // Cleanup old messages (30+ days)
  cleanupOldMessages: async (clientId) => {
    const { data } = await api.post(`/api/chat/${clientId}/cleanup`);
    return data;
  },

  // Send message (with optional images and source image options)
  sendMessage: async (clientId, message, options = {}) => {
    const { images = [], includeSourceImages = false, sourceDocumentIds = [], conversationId = null } = options;

    if (images.length > 0 || includeSourceImages || sourceDocumentIds.length > 0) {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('includeSourceImages', includeSourceImages);
      if (conversationId) {
        formData.append('conversationId', conversationId);
      }

      if (sourceDocumentIds.length > 0) {
        formData.append('sourceDocumentIds', JSON.stringify(sourceDocumentIds));
      }

      // Append multiple images
      images.forEach((image) => {
        formData.append('images', image);
      });

      const { data } = await api.post(`/api/chat/${clientId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    } else {
      const { data } = await api.post(`/api/chat/${clientId}`, { message, conversationId });
      return data.data;
    }
  },

  // Clear chat history
  clearHistory: async (clientId) => {
    const { data } = await api.delete(`/api/chat/${clientId}`);
    return data;
  },

  // Get all images for a client (for selection in chat)
  getImages: async (clientId) => {
    const { data } = await api.get(`/api/chat/${clientId}/images`);
    return data.data;
  },

  // Analyze a specific image from sources
  analyzeImage: async (clientId, documentId, question = null) => {
    const { data } = await api.post(`/api/chat/${clientId}/analyze-image`, {
      documentId,
      question,
    });
    return data.data;
  },

  // Extract text/data from an image (OCR)
  extractFromImage: async (clientId, documentId = null, imageFile = null) => {
    if (imageFile) {
      const formData = new FormData();
      formData.append('image', imageFile);
      if (documentId) formData.append('documentId', documentId);

      const { data } = await api.post(`/api/chat/${clientId}/extract-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    } else {
      const { data } = await api.post(`/api/chat/${clientId}/extract-image`, { documentId });
      return data.data;
    }
  },
};
