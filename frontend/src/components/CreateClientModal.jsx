import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Loader2, Crown } from 'lucide-react';
import { clientsApi } from '../api/clients';

export default function CreateClientModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [isSuperclient, setIsSuperclient] = useState(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('is_superclient', isSuperclient);
    if (thumbnail) {
      formData.append('thumbnail', thumbnail);
    }

    await createMutation.mutateAsync(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative bg-neutral-900 border border-neutral-700 rounded-xl shadow-soft-lg max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-medium text-neutral-100">
              Create New Client
            </h2>
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
                rows={3}
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
                {thumbnailPreview ? (
                  <img
                    src={thumbnailPreview}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-neutral-700"
                  />
                ) : (
                  <div className="w-16 h-16 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center">
                    <Upload className="w-6 h-6 text-neutral-600" />
                  </div>
                )}
                <label className="flex-1 cursor-pointer">
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
                className="inline-flex items-center px-4 py-2 bg-pastel-mint/15 hover:bg-pastel-mint/25 text-pastel-mint rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-pastel-mint/25"
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
