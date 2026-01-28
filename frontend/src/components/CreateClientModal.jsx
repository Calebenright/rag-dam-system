import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Loader2, Crown, Pipette } from 'lucide-react';
import { clientsApi } from '../api/clients';
import clsx from 'clsx';

// Pod color configuration
const POD_COLORS = {
  1: { name: 'Mint', bg: 'bg-pastel-mint', bgLight: 'bg-pastel-mint/20', text: 'text-pastel-mint', border: 'border-pastel-mint' },
  2: { name: 'Sky', bg: 'bg-pastel-sky', bgLight: 'bg-pastel-sky/20', text: 'text-pastel-sky', border: 'border-pastel-sky' },
  3: { name: 'Lemon', bg: 'bg-pastel-lemon', bgLight: 'bg-pastel-lemon/20', text: 'text-pastel-lemon', border: 'border-pastel-lemon' },
  4: { name: 'Lavender', bg: 'bg-pastel-lavender', bgLight: 'bg-pastel-lavender/20', text: 'text-pastel-lavender', border: 'border-pastel-lavender' },
};

export default function CreateClientModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [thumbnailBgColor, setThumbnailBgColor] = useState('#000000');
  const [podNumber, setPodNumber] = useState(1);
  const [isSuperclient, setIsSuperclient] = useState(false);
  const colorInputRef = useRef(null);
  const queryClient = useQueryClient();

  // Check if a superclient already exists
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.getAll,
  });
  const superclientExists = clients.some(c => c.is_superclient);

  const createMutation = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['clients']);
      handleClose();
    },
  });

  const handleClose = () => {
    setName('');
    setDescription('');
    setThumbnail(null);
    setThumbnailPreview(null);
    setThumbnailBgColor('#000000');
    setPodNumber(1);
    setIsSuperclient(false);
    onClose();
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnail(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Eyedropper function
  const extractColorFromImage = useCallback(() => {
    if ('EyeDropper' in window) {
      const eyeDropper = new window.EyeDropper();
      eyeDropper.open()
        .then(result => {
          setThumbnailBgColor(result.sRGBHex.toUpperCase());
        })
        .catch(() => {});
      return;
    }

    // Fallback: extract from thumbnail corners
    if (thumbnailPreview) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const samples = [
          ctx.getImageData(0, 0, 1, 1).data,
          ctx.getImageData(img.width - 1, 0, 1, 1).data,
          ctx.getImageData(0, img.height - 1, 1, 1).data,
          ctx.getImageData(img.width - 1, img.height - 1, 1, 1).data,
        ];

        const avgR = Math.round(samples.reduce((sum, s) => sum + s[0], 0) / 4);
        const avgG = Math.round(samples.reduce((sum, s) => sum + s[1], 0) / 4);
        const avgB = Math.round(samples.reduce((sum, s) => sum + s[2], 0) / 4);

        const hexColor = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`.toUpperCase();
        setThumbnailBgColor(hexColor);
      };
      img.src = thumbnailPreview;
    }
  }, [thumbnailPreview]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('is_superclient', isSuperclient);
    formData.append('pod_number', podNumber);
    formData.append('thumbnail_bg_color', thumbnailBgColor);
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    await createMutation.mutateAsync(formData);
  };

  if (!isOpen) return null;

  const currentPodColor = isSuperclient
    ? { bg: 'bg-pastel-coral', bgLight: 'bg-pastel-coral/20', text: 'text-pastel-coral', border: 'border-pastel-coral' }
    : POD_COLORS[podNumber];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl shadow-soft-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", currentPodColor.bgLight)}>
                <span className={clsx("text-sm font-bold", currentPodColor.text)}>+</span>
              </div>
              <h2 className="text-lg font-medium text-neutral-100">
                Create New Client
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-neutral-800 rounded-lg transition-all text-neutral-500 hover:text-neutral-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                Client Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 rounded-lg focus:ring-1 focus:ring-neutral-600 focus:border-neutral-600 transition-all"
                placeholder="Enter client name"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 rounded-lg focus:ring-1 focus:ring-neutral-600 focus:border-neutral-600 transition-all resize-none"
                placeholder="Add context about this client..."
              />
            </div>

            {/* Thumbnail */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                Thumbnail
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <div
                  className="w-16 h-16 rounded-lg border border-neutral-700 flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: thumbnailBgColor }}
                >
                  {thumbnailPreview ? (
                    <img
                      src={thumbnailPreview}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Upload className="w-6 h-6 text-neutral-600" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center px-3 py-2 bg-pastel-lavender/10 hover:bg-pastel-lavender/20 text-pastel-lavender rounded-lg transition-all border border-pastel-lavender/20 text-sm">
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Thumbnail Background Color */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                Background Color
              </label>
              <div className="flex items-center gap-2">
                {/* Color preview */}
                <div
                  className="w-10 h-10 rounded-lg border border-neutral-700 cursor-pointer transition-all hover:border-neutral-500"
                  style={{ backgroundColor: thumbnailBgColor }}
                  onClick={() => colorInputRef.current?.click()}
                />
                <input
                  ref={colorInputRef}
                  type="color"
                  value={thumbnailBgColor}
                  onChange={(e) => setThumbnailBgColor(e.target.value.toUpperCase())}
                  className="hidden"
                />
                <input
                  type="text"
                  value={thumbnailBgColor}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    if (/^#[0-9A-F]{0,6}$/.test(val)) {
                      setThumbnailBgColor(val);
                    }
                  }}
                  className="w-20 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-2 text-neutral-100 font-mono text-xs focus:outline-none focus:border-neutral-500 transition-colors"
                  placeholder="#000000"
                />
                <button
                  type="button"
                  onClick={extractColorFromImage}
                  disabled={!thumbnailPreview}
                  className={clsx(
                    "p-2 rounded-lg transition-all",
                    thumbnailPreview
                      ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      : "bg-neutral-900 text-neutral-600 cursor-not-allowed"
                  )}
                  title="Pick color from image"
                >
                  <Pipette className="w-4 h-4" />
                </button>
                {/* Quick presets */}
                {['#000000', '#FFFFFF', '#1A1A1A', '#F5F5F5'].map((color) => (
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

            {/* Pod Selection - only show if not superclient */}
            {!isSuperclient && (
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Pod
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => {
                    const podColor = POD_COLORS[num];
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setPodNumber(num)}
                        className={clsx(
                          'flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all',
                          podNumber === num
                            ? `${podColor.border} ${podColor.bgLight}`
                            : 'border-neutral-700 hover:border-neutral-600'
                        )}
                      >
                        <div className={clsx('w-5 h-5 rounded-full', podColor.bg)} />
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

            {/* Superclient Option */}
            {!superclientExists && (
              <div className="flex items-center gap-3 p-3 bg-pastel-coral/5 rounded-lg border border-pastel-coral/20">
                <input
                  type="checkbox"
                  id="isSuperclient"
                  checked={isSuperclient}
                  onChange={(e) => setIsSuperclient(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-pastel-coral focus:ring-pastel-coral/50"
                />
                <label htmlFor="isSuperclient" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-pastel-coral" />
                    <span className="text-sm font-medium text-neutral-200">Make Superclient</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Superclient has access to Leads verification and global tools
                  </p>
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-700">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !name}
                className={clsx(
                  "inline-flex items-center px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border",
                  currentPodColor.bgLight,
                  currentPodColor.text,
                  `${currentPodColor.border}/25`
                )}
              >
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Create Client
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
