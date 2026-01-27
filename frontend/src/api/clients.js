import api from './axios';

export const clientsApi = {
  // Get all clients
  getAll: async () => {
    const { data } = await api.get('/api/clients');
    return data.data;
  },

  // Get single client
  getById: async (id) => {
    const { data } = await api.get(`/api/clients/${id}`);
    return data.data;
  },

  // Create client
  create: async (formData) => {
    const { data } = await api.post('/api/clients', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  // Update client (supports both FormData and plain object)
  update: async (id, updateData) => {
    const isFormData = updateData instanceof FormData;
    const { data } = await api.put(`/api/clients/${id}`, updateData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return data.data;
  },

  // Delete client
  delete: async (id) => {
    const { data } = await api.delete(`/api/clients/${id}`);
    return data;
  },
};
