import api from './axios';

export const sheetsApi = {
  // Connect a Google Sheet to a client
  connect: async (clientId, sheetUrl, name = null) => {
    const { data } = await api.post('/api/sheets/connect', {
      clientId,
      sheetUrl,
      name,
    });
    return data.data;
  },

  // Get all connected sheets for a client
  getConnectedSheets: async (clientId) => {
    const { data } = await api.get(`/api/sheets/${clientId}`);
    return data.data;
  },

  // Get spreadsheet info (refreshes tabs list)
  getSheetInfo: async (clientId, spreadsheetId) => {
    const { data } = await api.get(`/api/sheets/${clientId}/${spreadsheetId}/info`);
    return data.data;
  },

  // Read data from a sheet
  readSheet: async (clientId, spreadsheetId, options = {}) => {
    const { range, sheet } = options;
    const params = new URLSearchParams();
    if (range) params.append('range', range);
    if (sheet) params.append('sheet', sheet);

    const { data } = await api.get(
      `/api/sheets/${clientId}/${spreadsheetId}/read?${params.toString()}`
    );
    return data.data;
  },

  // Write data to a sheet range
  writeSheet: async (clientId, spreadsheetId, range, values) => {
    const { data } = await api.post(`/api/sheets/${clientId}/${spreadsheetId}/write`, {
      range,
      values,
    });
    return data.data;
  },

  // Append rows to a sheet
  appendRows: async (clientId, spreadsheetId, values, range = null) => {
    const { data } = await api.post(`/api/sheets/${clientId}/${spreadsheetId}/append`, {
      range,
      values,
    });
    return data.data;
  },

  // Update a single cell
  updateCell: async (clientId, spreadsheetId, sheet, cell, value) => {
    const { data } = await api.post(`/api/sheets/${clientId}/${spreadsheetId}/update-cell`, {
      sheet,
      cell,
      value,
    });
    return data.data;
  },

  // Clear a range
  clearRange: async (clientId, spreadsheetId, range) => {
    const { data } = await api.post(`/api/sheets/${clientId}/${spreadsheetId}/clear`, {
      range,
    });
    return data.data;
  },

  // Batch update multiple ranges
  batchUpdate: async (clientId, spreadsheetId, updates) => {
    const { data } = await api.post(`/api/sheets/${clientId}/${spreadsheetId}/batch`, {
      updates,
    });
    return data.data;
  },

  // Add a new sheet tab
  addTab: async (clientId, spreadsheetId, title) => {
    const { data } = await api.post(`/api/sheets/${clientId}/${spreadsheetId}/add-tab`, {
      title,
    });
    return data.data;
  },

  // Disconnect a sheet
  disconnect: async (clientId, spreadsheetId) => {
    const { data } = await api.delete(`/api/sheets/${clientId}/${spreadsheetId}`);
    return data;
  },

  // Chat with sheet editing capabilities
  chatWithSheet: async (clientId, spreadsheetId, message) => {
    const { data } = await api.post(`/api/chat/${clientId}/sheets`, {
      message,
      spreadsheetId,
    });
    return data.data;
  },
};

export default sheetsApi;
