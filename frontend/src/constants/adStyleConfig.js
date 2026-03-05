export const AD_STYLE_OPTIONS = {
  structure: {
    label: 'Structure',
    options: [
      { value: 'random', label: 'Random' },
      { value: 'hook-body-closer', label: 'Hook → Body → Closer', default: true },
      { value: 'hook-body', label: 'Hook → Body' },
      { value: 'single', label: 'Single Paragraph' },
      { value: 'listicle', label: 'Listicle (Bullets)' },
    ],
  },
  tone: {
    label: 'Tone',
    options: [
      { value: 'random', label: 'Random' },
      { value: 'conversational', label: 'Conversational', default: true },
      { value: 'professional', label: 'Professional' },
      { value: 'bold', label: 'Bold / Aggressive' },
      { value: 'friendly', label: 'Friendly / Warm' },
      { value: 'authoritative', label: 'Authoritative' },
    ],
  },
  hookStyle: {
    label: 'Hook Style',
    options: [
      { value: 'random', label: 'Random' },
      { value: 'pain-point', label: 'Pain Point Question', default: true },
      { value: 'bold-statement', label: 'Bold Statement' },
      { value: 'stat', label: 'Stat / Number' },
      { value: 'story', label: 'Story / Anecdote' },
      { value: 'direct-address', label: 'Direct Address' },
    ],
  },
  length: {
    label: 'Length',
    options: [
      { value: 'short', label: 'Short (~100 chars)' },
      { value: 'medium', label: 'Medium (~200 chars)', default: true },
      { value: 'long', label: 'Long (~350 chars)' },
    ],
  },
};

export function getDefaultStyleConfig() {
  const defaults = {};
  for (const [key, config] of Object.entries(AD_STYLE_OPTIONS)) {
    const defaultOpt = config.options.find(o => o.default);
    defaults[key] = defaultOpt?.value || config.options[0].value;
  }
  defaults.emoji = false;
  defaults.funnel = 'TOF';
  return defaults;
}
