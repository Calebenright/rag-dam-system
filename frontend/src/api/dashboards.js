import { api as sharedApi } from './axios';

const api = {
  get: (url, config) => sharedApi.get(`/api/dashboards${url}`, config),
  post: (url, data, config) => sharedApi.post(`/api/dashboards${url}`, data, config),
  put: (url, data, config) => sharedApi.put(`/api/dashboards${url}`, data, config),
  delete: (url, config) => sharedApi.delete(`/api/dashboards${url}`, config),
};

// ==================== SOURCES ====================

export const sourcesApi = {
  // Get all sources for a client
  getByClientId: async (clientId) => {
    const response = await api.get(`/sources/${clientId}`);
    return response.data.data;
  },

  // Create a new source
  create: async ({ clientId, name, sheetUrl, columnMappings, group }) => {
    const response = await api.post('/sources', {
      clientId,
      name,
      sheetUrl,
      columnMappings,
      group,
    });
    return response.data.data;
  },

  // Update a source
  update: async (sourceId, updates) => {
    const response = await api.put(`/sources/${sourceId}`, updates);
    return response.data.data;
  },

  // Delete a source
  delete: async (sourceId) => {
    const response = await api.delete(`/sources/${sourceId}`);
    return response.data;
  },

  // Refresh data from a source
  refresh: async (sourceId, tabName) => {
    const response = await api.post(`/sources/${sourceId}/refresh`, { tabName });
    return response.data.data;
  },

  // Get data from a source
  getData: async (sourceId, { tab, useCache = true } = {}) => {
    const params = new URLSearchParams();
    if (tab) params.append('tab', tab);
    if (useCache) params.append('useCache', 'true');
    const response = await api.get(`/sources/${sourceId}/data?${params}`);
    return response.data;
  },

  // Get all unique groups for a client's sources
  getGroups: async (clientId) => {
    const response = await api.get(`/sources/${clientId}/groups`);
    return response.data.data;
  },

  // Set group for a single source
  setGroup: async (sourceId, group) => {
    const response = await sharedApi.patch(`/api/dashboards/sources/${sourceId}/group`, { group });
    return response.data.data;
  },

  // Bulk set group for multiple sources
  bulkSetGroup: async (sourceIds, group) => {
    const response = await sharedApi.patch(`/api/dashboards/sources/bulk-group`, { sourceIds, group });
    return response.data.data;
  },
};

// ==================== DASHBOARDS ====================

export const dashboardsApi = {
  // Get all dashboards for a client
  getByClientId: async (clientId) => {
    const response = await api.get(`/${clientId}`);
    return response.data.data;
  },

  // Get a single dashboard with widgets
  getById: async (dashboardId) => {
    const response = await api.get(`/detail/${dashboardId}`);
    return response.data.data;
  },

  // Create a new dashboard
  create: async ({ clientId, name, description, layout, settings }) => {
    const response = await api.post('/', {
      clientId,
      name,
      description,
      layout,
      settings,
    });
    return response.data.data;
  },

  // Update a dashboard
  update: async (dashboardId, updates) => {
    const response = await api.put(`/${dashboardId}`, updates);
    return response.data.data;
  },

  // Delete a dashboard
  delete: async (dashboardId) => {
    const response = await api.delete(`/${dashboardId}`);
    return response.data;
  },
};

// ==================== WIDGETS ====================

export const widgetsApi = {
  // Add a widget to a dashboard
  create: async (dashboardId, widget) => {
    const response = await api.post(`/${dashboardId}/widgets`, widget);
    return response.data.data;
  },

  // Update a widget
  update: async (widgetId, updates) => {
    const response = await api.put(`/widgets/${widgetId}`, updates);
    return response.data.data;
  },

  // Delete a widget
  delete: async (widgetId) => {
    const response = await api.delete(`/widgets/${widgetId}`);
    return response.data;
  },

  // Batch update widget positions
  updatePositions: async (dashboardId, positions) => {
    const response = await api.put(`/${dashboardId}/widgets/positions`, { positions });
    return response.data;
  },
};

export default {
  sources: sourcesApi,
  dashboards: dashboardsApi,
  widgets: widgetsApi,
};
