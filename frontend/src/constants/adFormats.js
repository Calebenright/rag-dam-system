export const AD_FORMATS = {
  google: {
    name: 'Google Search Ads',
    fields: {
      headlines: { label: 'Headlines', count: 3, maxChars: 30, required: true },
      descriptions: { label: 'Descriptions', count: 2, maxChars: 90, required: true },
      displayUrl: { label: 'Display URL Path', count: 1, maxChars: 35, required: false },
      sitelinks: { label: 'Sitelinks', count: 1, maxChars: 120, required: false, hint: 'pipe-separated' },
    },
  },
  meta: {
    name: 'Meta / Instagram Ads',
    fields: {
      primaryText: { label: 'Primary Text', count: 1, required: true },
      headlines: { label: 'Headline', count: 1, maxChars: 40, required: true },
      cta: { label: 'CTA Button', count: 1, enum: ['Learn More', 'Shop Now', 'Sign Up', 'Contact Us', 'Download', 'Get Offer', 'Book Now', 'Subscribe', 'Apply Now', 'Get Quote'], required: true },
      descriptions: { label: 'Description', count: 1, maxChars: 30, required: false },
      hashtags: { label: 'Hashtags', count: 1, maxChars: 200, required: false },
    },
  },
  linkedin: {
    name: 'LinkedIn Sponsored Content',
    fields: {
      introText: { label: 'Intro Text', count: 1, maxChars: 3000, required: true },
      headlines: { label: 'Headline', count: 1, maxChars: 70, required: true },
      descriptions: { label: 'Description', count: 1, maxChars: 100, required: false },
      cta: { label: 'CTA Button', count: 1, enum: ['Learn More', 'Sign Up', 'Subscribe', 'Register', 'Apply', 'Download', 'Get Quote', 'Request Demo', 'Join', 'Attend'], required: true },
    },
  },
  reddit: {
    name: 'Reddit Promoted Posts',
    fields: {
      postTitle: { label: 'Post Title', count: 1, maxChars: 300, required: true },
      primaryText: { label: 'Body Text', count: 1, required: true },
      cta: { label: 'CTA Button', count: 1, enum: ['Learn More', 'Shop Now', 'Sign Up', 'Download', 'Install', 'Get Started', 'Watch Now', 'Play Now', 'Contact Us', 'Apply Now'], required: true },
      displayUrl: { label: 'Display URL', count: 1, maxChars: 50, required: false },
    },
  },
};
