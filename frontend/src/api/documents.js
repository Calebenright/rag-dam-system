import api from './axios';

export const documentsApi = {
  // Get all documents for a client
  getByClientId: async (clientId) => {
    const { data } = await api.get(`/api/documents/${clientId}`);
    return data.data;
  },

  // Get single document
  getById: async (documentId) => {
    const { data } = await api.get(`/api/documents/detail/${documentId}`);
    return data.data;
  },

  // Upload document
  upload: async (clientId, file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post(`/api/documents/${clientId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    });
    return data.data;
  },

  // Delete document
  delete: async (documentId) => {
    const { data } = await api.delete(`/api/documents/${documentId}`);
    return data;
  },

  // Search documents
  search: async (clientId, query, limit = 5) => {
    const { data } = await api.post(`/api/documents/search/${clientId}`, {
      query,
      limit,
    });
    return data.data;
  },

  // Add Google Doc/Sheet as source
  addGoogleDoc: async (clientId, url) => {
    const { data } = await api.post(`/api/documents/${clientId}/google`, { url });
    return data.data;
  },

  // Sync/refresh Google Doc
  syncGoogleDoc: async (documentId) => {
    const { data } = await api.post(`/api/documents/${documentId}/sync`);
    return data;
  },

  // Sync all Google sources (only if changed)
  syncAllGoogleDocs: async (clientId) => {
    const { data } = await api.post(`/api/documents/${clientId}/sync-all`);
    return data;
  },
};
