import api from './axios';

export const adgenApi = {
  // Generate ad copy variations
  generate: async (clientId, { text, url, platform, images, variationCount, styleConfig, positiveWords, negativeWords, customPrompt }) => {
    const formData = new FormData();
    if (text) formData.append('text', text);
    if (url) formData.append('url', url);
    formData.append('platform', platform);
    if (variationCount) formData.append('variationCount', String(variationCount));
    if (images && images.length > 0) {
      images.forEach(img => formData.append('images', img));
    }
    if (styleConfig) {
      formData.append('styleConfig', JSON.stringify(styleConfig));
    }
    if (positiveWords) formData.append('positiveWords', positiveWords);
    if (negativeWords) formData.append('negativeWords', negativeWords);
    if (customPrompt) formData.append('customPrompt', customPrompt);

    const { data } = await api.post(`/api/adgen/${clientId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 60s — generation can take a while
    });
    return data.data;
  },

  // Regenerate a single field
  regenerate: async (clientId, { field, currentValue, allFields, platform, direction, styleConfig, positiveWords, negativeWords, customPrompt }) => {
    const { data } = await api.post(`/api/adgen/${clientId}/regenerate`, {
      field, currentValue, allFields, platform, direction, styleConfig, positiveWords, negativeWords, customPrompt,
    });
    return data.data;
  },

  // Push ad copy to Google Sheet
  pushToSheet: async (clientId, { fields, platform, funnel, hookStyle, url, urlTitle, hadImages }) => {
    const { data } = await api.post(`/api/adgen/${clientId}/push-to-sheet`, {
      fields, platform, funnel, hookStyle, url, urlTitle, hadImages,
    });
    return data.data;
  },
};
