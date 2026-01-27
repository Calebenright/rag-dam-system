import api from './axios';

export const leadsApi = {
  // === Leads Sheets Management (separate from regular sheets) ===

  // Connect a Google Sheet for leads
  connectSheet: async (sheetUrl, name = null) => {
    const { data } = await api.post('/api/leads/sheets/connect', {
      sheetUrl,
      name,
    });
    return data.data;
  },

  // Get all connected leads sheets
  getSheets: async () => {
    const { data } = await api.get('/api/leads/sheets');
    return data.data;
  },

  // Get leads sheet info (refresh tabs)
  getSheetInfo: async (spreadsheetId) => {
    const { data } = await api.get(`/api/leads/sheets/${spreadsheetId}/info`);
    return data.data;
  },

  // Disconnect a leads sheet
  disconnectSheet: async (spreadsheetId) => {
    const { data } = await api.delete(`/api/leads/sheets/${spreadsheetId}`);
    return data;
  },

  // === Verification ===

  // Check if verification backends are available
  getStatus: async () => {
    const { data } = await api.get('/api/leads/status');
    return data.data;
  },

  // === Backend Control ===

  // Start email backend (Docker)
  startEmailBackend: async () => {
    const { data } = await api.post('/api/leads/backends/email/start');
    return data;
  },

  // Stop email backend
  stopEmailBackend: async () => {
    const { data } = await api.post('/api/leads/backends/email/stop');
    return data;
  },

  // Start phone backend
  startPhoneBackend: async () => {
    const { data } = await api.post('/api/leads/backends/phone/start');
    return data;
  },

  // Stop phone backend
  stopPhoneBackend: async () => {
    const { data } = await api.post('/api/leads/backends/phone/stop');
    return data;
  },

  // Verify a single email
  verifyEmail: async (email) => {
    const { data } = await api.post('/api/leads/verify-email', { email });
    return data.data;
  },

  // Verify a single phone number
  verifyPhone: async (phone, useNumVerify = false) => {
    const { data } = await api.post('/api/leads/verify-phone', { phone, useNumVerify });
    return data.data;
  },

  // Get sheet preview with column headers
  getSheetPreview: async (spreadsheetId, sheetName = null) => {
    const params = new URLSearchParams();
    if (sheetName) params.append('sheetName', sheetName);

    const { data } = await api.get(
      `/api/leads/${spreadsheetId}/preview?${params.toString()}`
    );
    return data.data;
  },

  // Run batch verification on a sheet (non-streaming)
  runVerification: async (spreadsheetId, options) => {
    const { sheetName, emailColumn, phoneColumn, useNumVerify } = options;

    const { data } = await api.post(
      `/api/leads/${spreadsheetId}/verify`,
      { sheetName, emailColumn, phoneColumn, useNumVerify }
    );
    return data.data;
  },

  // Create an EventSource for streaming verification progress
  createVerificationStream: (spreadsheetId, options) => {
    const { sheetName, emailColumn, phoneColumn, useNumVerify } = options;

    const params = new URLSearchParams();
    if (sheetName) params.append('sheetName', sheetName);
    if (emailColumn) params.append('emailColumn', emailColumn);
    if (phoneColumn) params.append('phoneColumn', phoneColumn);
    if (useNumVerify) params.append('useNumVerify', 'true');

    const baseUrl = api.defaults.baseURL || '';
    const url = `${baseUrl}/api/leads/${spreadsheetId}/verify-stream?${params.toString()}`;

    return new EventSource(url);
  },
};

export default leadsApi;
