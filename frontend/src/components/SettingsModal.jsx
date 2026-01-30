import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Copy, RefreshCw, Check, Code, Settings, Upload, User, Pipette, Bot } from 'lucide-react';
import { clientsApi } from '../api/clients';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';

// Pod color configuration
const POD_COLORS = {
  1: { name: 'Mint', color: 'pastel-mint', bg: 'bg-pastel-mint', bgLight: 'bg-pastel-mint/20', text: 'text-pastel-mint', border: 'border-pastel-mint' },
  2: { name: 'Sky', color: 'pastel-sky', bg: 'bg-pastel-sky', bgLight: 'bg-pastel-sky/20', text: 'text-pastel-sky', border: 'border-pastel-sky' },
  3: { name: 'Lemon', color: 'pastel-lemon', bg: 'bg-pastel-lemon', bgLight: 'bg-pastel-lemon/20', text: 'text-pastel-lemon', border: 'border-pastel-lemon' },
  4: { name: 'Lavender', color: 'pastel-lavender', bg: 'bg-pastel-lavender', bgLight: 'bg-pastel-lavender/20', text: 'text-pastel-lavender', border: 'border-pastel-lavender' },
};

const SUPERCLIENT_COLOR = { name: 'Coral', color: 'pastel-coral', bg: 'bg-pastel-coral', bgLight: 'bg-pastel-coral/20', text: 'text-pastel-coral', border: 'border-pastel-coral' };

export function getPodColor(client) {
  if (client?.is_superclient) return SUPERCLIENT_COLOR;
  return POD_COLORS[client?.pod_number] || POD_COLORS[1];
}

export default function SettingsModal({ isOpen, onClose, client, showApiTab = false }) {
  const [activeTab, setActiveTab] = useState('client');
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(client?.name || '');
  const [description, setDescription] = useState(client?.description || '');
  const [podNumber, setPodNumber] = useState(client?.pod_number || 1);
  const [thumbnailPreview, setThumbnailPreview] = useState(client?.thumbnail_url || null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailBgColor, setThumbnailBgColor] = useState(client?.thumbnail_bg_color || '#000000');
  const fileInputRef = useRef(null);
  const colorInputRef = useRef(null);
  const canvasRef = useRef(null);
  const queryClient = useQueryClient();

  // Reset form when client changes
  useEffect(() => {
    if (client) {
      setName(client.name || '');
      setDescription(client.description || '');
      setPodNumber(client.pod_number || 1);
      setThumbnailPreview(client.thumbnail_url || null);
      setThumbnailFile(null);
      setThumbnailBgColor(client.thumbnail_bg_color || '#000000');
      setActiveTab('client');
    }
  }, [client?.id]);

  // Eyedropper function using canvas to extract color from image
  const extractColorFromImage = useCallback(() => {
    // Try native EyeDropper API first (Chrome 95+)
    if ('EyeDropper' in window) {
      const eyeDropper = new window.EyeDropper();
      eyeDropper.open()
        .then(result => {
          setThumbnailBgColor(result.sRGBHex);
        })
        .catch(() => {
          // User cancelled or error
        });
      return;
    }

    // Fallback: extract dominant color from thumbnail using canvas
    if (thumbnailPreview) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Sample corners for background color (usually bg is in corners)
        const samples = [
          ctx.getImageData(0, 0, 1, 1).data,
          ctx.getImageData(img.width - 1, 0, 1, 1).data,
          ctx.getImageData(0, img.height - 1, 1, 1).data,
          ctx.getImageData(img.width - 1, img.height - 1, 1, 1).data,
        ];

        // Average the corner colors
        const avgR = Math.round(samples.reduce((sum, s) => sum + s[0], 0) / 4);
        const avgG = Math.round(samples.reduce((sum, s) => sum + s[1], 0) / 4);
        const avgB = Math.round(samples.reduce((sum, s) => sum + s[2], 0) / 4);

        const hexColor = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`.toUpperCase();
        setThumbnailBgColor(hexColor);
      };
      img.src = thumbnailPreview;
    }
  }, [thumbnailPreview]);

  const updateClientMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('pod_number', podNumber);
      formData.append('thumbnail_bg_color', thumbnailBgColor);
      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile);
      }
      return clientsApi.update(client.id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['client', client.id]);
      queryClient.invalidateQueries(['clients']);
    },
  });

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  const baseUrl = window.location.origin.replace('5173', '3001').replace('3000', '3001');
  const currentPodColor = client?.is_superclient ? SUPERCLIENT_COLOR : POD_COLORS[podNumber] || POD_COLORS[1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-neutral-900 rounded-2xl border border-neutral-800 w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", currentPodColor.bgLight)}>
              <Settings className={clsx("w-4 h-4", currentPodColor.text)} />
            </div>
            <h2 className="text-lg font-semibold text-neutral-100">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs - only show if API tab is enabled */}
        {showApiTab && (
          <div className="flex border-b border-neutral-800">
            <button
              onClick={() => setActiveTab('client')}
              className={clsx(
                'flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2',
                activeTab === 'client'
                  ? `${currentPodColor.text} border-b-2 ${currentPodColor.border}`
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              <User className="w-4 h-4" />
              Client
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={clsx(
                'flex-1 px-4 py-3 text-sm font-medium transition-all flex items-center justify-center gap-2',
                activeTab === 'api'
                  ? `${currentPodColor.text} border-b-2 ${currentPodColor.border}`
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              <Code className="w-4 h-4" />
              API
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-6">
          {activeTab === 'client' || !showApiTab ? (
            <div className="space-y-6">
              {/* Thumbnail */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-neutral-200">Thumbnail</label>
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={clsx(
                      "w-20 h-20 rounded-xl border-2 border-dashed cursor-pointer transition-all flex items-center justify-center overflow-hidden",
                      thumbnailPreview ? "border-neutral-700" : "border-neutral-700 hover:border-neutral-500"
                    )}
                  >
                    {thumbnailPreview ? (
                      <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <Upload className="w-6 h-6 text-neutral-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      Click to upload
                    </button>
                    <p className="text-xs text-neutral-500 mt-1">PNG or JPG, max 5MB</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Thumbnail Background Color */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-neutral-200">Thumbnail Background</label>
                <div className="flex items-center gap-3">
                  {/* Color preview */}
                  <div
                    className="w-12 h-12 rounded-lg border border-neutral-700 cursor-pointer transition-all hover:border-neutral-500"
                    style={{ backgroundColor: thumbnailBgColor }}
                    onClick={() => colorInputRef.current?.click()}
                  />

                  {/* Color input */}
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={thumbnailBgColor}
                    onChange={(e) => setThumbnailBgColor(e.target.value.toUpperCase())}
                    className="hidden"
                  />

                  {/* Hex input */}
                  <input
                    type="text"
                    value={thumbnailBgColor}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      if (/^#[0-9A-F]{0,6}$/.test(val)) {
                        setThumbnailBgColor(val);
                      }
                    }}
                    className="w-24 bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 font-mono text-sm focus:outline-none focus:border-neutral-500 transition-colors"
                    placeholder="#FFFFFF"
                  />

                  {/* Eyedropper button */}
                  <button
                    type="button"
                    onClick={extractColorFromImage}
                    disabled={!thumbnailPreview}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      thumbnailPreview
                        ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100"
                        : "bg-neutral-900 text-neutral-600 cursor-not-allowed"
                    )}
                    title={thumbnailPreview ? "Pick color from image" : "Upload an image first"}
                  >
                    <Pipette className="w-4 h-4" />
                    Pick
                  </button>

                  {/* Quick presets */}
                  <div className="flex gap-1.5">
                    {['#FFFFFF', '#000000', '#F5F5F5', '#1A1A1A'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setThumbnailBgColor(color)}
                        className={clsx(
                          "w-8 h-8 rounded-lg border transition-all",
                          thumbnailBgColor === color
                            ? "border-pastel-mint ring-2 ring-pastel-mint/30"
                            : "border-neutral-700 hover:border-neutral-500"
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-neutral-500">
                  Click the color square or use the eyedropper to pick a color from the image
                </p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-200">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
                  placeholder="Client name"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-200">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors resize-none"
                  placeholder="Brief description of the client"
                />
              </div>

              {/* Pod Number */}
              {!client?.is_superclient && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-neutral-200">Pod</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((num) => {
                      const podColor = POD_COLORS[num];
                      return (
                        <button
                          key={num}
                          onClick={() => setPodNumber(num)}
                          className={clsx(
                            'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all',
                            podNumber === num
                              ? `${podColor.border} ${podColor.bgLight}`
                              : 'border-neutral-700 hover:border-neutral-600'
                          )}
                        >
                          <div className={clsx('w-6 h-6 rounded-full', podColor.bg)} />
                          <span className={clsx(
                            'text-xs font-medium',
                            podNumber === num ? podColor.text : 'text-neutral-400'
                          )}>
                            Pod {num}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {client?.is_superclient && (
                <div className="bg-pastel-coral/10 border border-pastel-coral/20 rounded-lg p-4">
                  <p className="text-sm text-neutral-300">
                    <span className="text-pastel-coral font-medium">Superclient:</span> This client has special privileges and uses the coral color theme.
                  </p>
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={() => updateClientMutation.mutate()}
                disabled={updateClientMutation.isPending || !name.trim()}
                className={clsx(
                  "w-full py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                  updateClientMutation.isPending || !name.trim()
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : `${currentPodColor.bgLight} ${currentPodColor.text} hover:opacity-80`
                )}
              >
                {updateClientMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : updateClientMutation.isSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* API Key */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-pastel-mint" />
                  <h3 className="text-sm font-medium text-neutral-200">API Key</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 font-mono text-xs text-neutral-300 overflow-x-auto">
                    dk_global_a7f3e9c2b8d14506923f1e8a4b7c6d0e5f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c
                  </div>
                  <button
                    onClick={() => copyToClipboard('dk_global_a7f3e9c2b8d14506923f1e8a4b7c6d0e5f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c')}
                    className="px-3 py-3 text-neutral-400 hover:text-pastel-mint hover:bg-neutral-800 rounded-lg transition-all"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </section>

              {/* Divider */}
              <div className="border-t border-neutral-800" />

              {/* API Documentation */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-pastel-sky" />
                  <h3 className="text-sm font-medium text-neutral-200">Upload Source</h3>
                </div>

                {/* Endpoint */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-pastel-mint/20 text-pastel-mint rounded text-xs font-medium">POST</span>
                    <code className="text-sm text-neutral-300">{baseUrl}/api/documents/api-upload</code>
                  </div>
                </div>

                {/* Headers */}
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Headers</p>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300">
                    <pre>{`Content-Type: application/json
X-API-Key: dk_global_a7f3e9c2b8d1...`}</pre>
                  </div>
                </div>

                {/* Request Body */}
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Request Body</p>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300">
                    <pre>{`{
  "url": "https://docs.google.com/...",
  "client": "${client?.name || 'Client Name or ID'}"
}`}</pre>
                  </div>
                </div>

                {/* Example */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Example (cURL)</span>
                    <button
                      onClick={() => copyToClipboard(`curl -X POST "${baseUrl}/api/documents/api-upload" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dk_global_a7f3e9c2b8d14506923f1e8a4b7c6d0e5f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c" \\
  -d '{"url": "https://docs.google.com/document/d/your-doc-id/edit", "client": "${client?.name || 'Client Name'}"}'`)}
                      className="text-xs text-neutral-500 hover:text-pastel-mint transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300 overflow-x-auto">
                    <pre>{`curl -X POST "${baseUrl}/api/documents/api-upload" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dk_global_a7f3e9c2b8d1..." \\
  -d '{
    "url": "https://docs.google.com/...",
    "client": "${client?.name || 'Client Name'}"
  }'`}</pre>
                  </div>
                </div>

                {/* Client identification info */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-3">Client Field</p>
                  <p className="text-sm text-neutral-400">
                    The <code className="text-pastel-sky">client</code> field accepts:
                  </p>
                  <ul className="text-sm text-neutral-400 list-disc list-inside space-y-1 mt-2">
                    <li>Client name (case-insensitive): <code className="text-pastel-mint">"{client?.name || 'My Client'}"</code></li>
                    <li>Client UUID: <code className="text-pastel-mint">"{client?.id || 'uuid-here'}"</code></li>
                  </ul>
                </div>

                {/* Supported URLs */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-3">Supported URLs</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">Google Docs</span>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Google Sheets</span>
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">Web URLs (PDF, DOCX, etc.)</span>
                  </div>
                </div>
              </section>

              {/* Divider */}
              <div className="border-t border-neutral-800" />

              {/* Create Client API */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-pastel-lavender" />
                  <h3 className="text-sm font-medium text-neutral-200">Create Client</h3>
                </div>

                {/* Endpoint */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-pastel-mint/20 text-pastel-mint rounded text-xs font-medium">POST</span>
                    <code className="text-sm text-neutral-300">{baseUrl}/api/documents/api-create-client</code>
                  </div>
                </div>

                {/* Request Body */}
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Request Body</p>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300">
                    <pre>{`{
  "name": "Client Name",      // required
  "description": "Optional",  // optional
  "pod_number": 1             // optional (1-4)
}`}</pre>
                  </div>
                </div>

                {/* Example */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Example (cURL)</span>
                    <button
                      onClick={() => copyToClipboard(`curl -X POST "${baseUrl}/api/documents/api-create-client" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dk_global_a7f3e9c2b8d14506923f1e8a4b7c6d0e5f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c" \\
  -d '{"name": "New Client", "description": "Client description", "pod_number": 2}'`)}
                      className="text-xs text-neutral-500 hover:text-pastel-mint transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300 overflow-x-auto">
                    <pre>{`curl -X POST "${baseUrl}/api/documents/api-create-client" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dk_global_a7f3e9c2b8d1..." \\
  -d '{
    "name": "New Client",
    "description": "Client description",
    "pod_number": 2
  }'`}</pre>
                  </div>
                </div>

                {/* Response */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-3">Response</p>
                  <div className="font-mono text-xs text-neutral-300">
                    <pre>{`{
  "success": true,
  "data": { "id": "uuid", "name": "...", ... },
  "message": "Client created successfully"
}`}</pre>
                  </div>
                </div>
              </section>

              {/* Divider */}
              <div className="border-t border-neutral-800" />

              {/* Agent API */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-pastel-coral" />
                  <h3 className="text-sm font-medium text-neutral-200">AI Agent Query</h3>
                </div>

                {/* Endpoint */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-pastel-mint/20 text-pastel-mint rounded text-xs font-medium">POST</span>
                    <code className="text-sm text-neutral-300">{baseUrl}/api/agent/query</code>
                  </div>
                </div>

                {/* Request Body */}
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Request Body</p>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300">
                    <pre>{`{
  "prompt": "Your question here",
  "clientId": "${client?.id || 'client-uuid'}",
  "saveHistory": false  // optional
}`}</pre>
                  </div>
                </div>

                {/* Example */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Example (cURL)</span>
                    <button
                      onClick={() => copyToClipboard(`curl -X POST "${baseUrl}/api/agent/query" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dk_global_a7f3e9c2b8d14506923f1e8a4b7c6d0e5f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c" \\
  -d '{"prompt": "What documents do we have?", "clientId": "${client?.id || 'client-uuid'}"}'`)}
                      className="text-xs text-neutral-500 hover:text-pastel-mint transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300 overflow-x-auto">
                    <pre>{`curl -X POST "${baseUrl}/api/agent/query" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: dk_global_a7f3e9c2b8d1..." \\
  -d '{
    "prompt": "What documents do we have?",
    "clientId": "${client?.id || 'client-uuid'}"
  }'`}</pre>
                  </div>
                </div>

                {/* Response */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-3">Response</p>
                  <div className="font-mono text-xs text-neutral-300">
                    <pre>{`{
  "success": true,
  "data": {
    "response": "AI response text...",
    "client": { "id": "...", "name": "..." },
    "context": {
      "documentsUsed": 3,
      "chunksUsed": 5,
      "sheetsAvailable": 1
    }
  }
}`}</pre>
                  </div>
                </div>

                {/* Additional Endpoints */}
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 space-y-3">
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Other Agent Endpoints</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-pastel-sky/20 text-pastel-sky rounded text-xs font-medium">GET</span>
                      <code className="text-neutral-300">/api/agent/clients</code>
                      <span className="text-neutral-500 text-xs ml-auto">List all clients</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-pastel-sky/20 text-pastel-sky rounded text-xs font-medium">GET</span>
                      <code className="text-neutral-300">/api/agent/clients/:id/context</code>
                      <span className="text-neutral-500 text-xs ml-auto">Get client context</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
