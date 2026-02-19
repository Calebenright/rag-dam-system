import api from './axios';

export const documentsApi = {
  // Get all documents for a client (includes global sources)
  getByClientId: async (clientId) => {
    const { data } = await api.get(`/api/documents/${clientId}`);
    return data.data;
  },

  // Get single document
  getById: async (documentId) => {
    const { data } = await api.get(`/api/documents/detail/${documentId}`);
    return data.data;
  },

  // Upload document (supports isGlobal flag for global sources)
  upload: async (clientId, file, onUploadProgress, isGlobal = false) => {
    const formData = new FormData();
    formData.append('file', file);
    if (isGlobal) formData.append('isGlobal', 'true');

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

  // Add Google Doc/Sheet as source (supports isGlobal flag)
  addGoogleDoc: async (clientId, url, isGlobal = false) => {
    const { data } = await api.post(`/api/documents/${clientId}/google`, { url, isGlobal });
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

  // Upload source via API (URL-based: Google Docs, Google Sheets, or web URLs)
  apiUpload: async (clientId, url) => {
    const { data } = await api.post(`/api/documents/${clientId}/api-upload`, { url });
    return data.data;
  },

  // Update custom group for a document
  updateGroup: async (documentId, group) => {
    const { data } = await api.patch(`/api/documents/${documentId}/group`, { group });
    return data;
  },

  // Bulk update custom group for multiple documents
  bulkUpdateGroup: async (documentIds, group) => {
    const { data } = await api.patch(`/api/documents/bulk-group`, { documentIds, group });
    return data;
  },

  // Get all custom groups for a client
  getGroups: async (clientId) => {
    const { data } = await api.get(`/api/documents/${clientId}/groups`);
    return data.data;
  },
};
