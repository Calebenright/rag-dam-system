import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2, Link, FileText, FileSpreadsheet } from 'lucide-react';
import { documentsApi } from '../api/documents';

export default function DocumentUpload({ clientId }) {
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [googleUrl, setGoogleUrl] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [addedDoc, setAddedDoc] = useState(null); // Track successfully added doc with name
  const [activeTab, setActiveTab] = useState('file'); // 'file' or 'google'
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: ({ file }) => {
      return documentsApi.upload(clientId, file, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.name === file.name ? { ...f, progress } : f
          )
        );
      });
    },
    onSuccess: (data, { file }) => {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.name === file.name ? { ...f, status: 'success' } : f
        )
      );
      queryClient.invalidateQueries(['documents', clientId]);

      // Remove from list after 2 seconds
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
      }, 2000);
    },
    onError: (error, { file }) => {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.name === file.name
            ? { ...f, status: 'error', error: error.message }
            : f
        )
      );
    },
  });

  const googleMutation = useMutation({
    mutationFn: (url) => documentsApi.addGoogleDoc(clientId, url),
    onSuccess: (data) => {
      setGoogleUrl('');
      setGoogleError('');
      // Store the added document info to show the name
      setAddedDoc({
        name: data.file_name,
        type: data.file_type,
        url: data.file_url,
      });
      queryClient.invalidateQueries(['documents', clientId]);
      // Clear the success message after 5 seconds
      setTimeout(() => setAddedDoc(null), 5000);
    },
    onError: (error) => {
      setGoogleError(error.response?.data?.error || error.message);
    },
  });

  const onDrop = useCallback(
    (acceptedFiles) => {
      acceptedFiles.forEach((file) => {
        // Add to uploading list
        setUploadingFiles((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            status: 'uploading',
            progress: 0,
          },
        ]);

        // Start upload
        uploadMutation.mutate({ file });
      });
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxSize: 10485760, // 10MB
  });

  const removeFile = (fileName) => {
    setUploadingFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleGoogleSubmit = (e) => {
    e.preventDefault();
    if (!googleUrl.trim()) return;

    // Validate URL - accept both Docs and Sheets
    if (!googleUrl.includes('docs.google.com')) {
      setGoogleError('Please enter a valid Google Docs or Google Sheets URL');
      return;
    }

    setGoogleError('');
    setAddedDoc(null);
    googleMutation.mutate(googleUrl.trim());
  };

  // Determine if URL is a Sheet or Doc
  const getUrlType = (url) => {
    if (url.includes('/spreadsheets/')) return 'sheet';
    if (url.includes('/document/')) return 'doc';
    return null;
  };

  const urlType = getUrlType(googleUrl);

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2 p-1 bg-dark-800/50 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('file')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'file'
              ? 'bg-accent-purple/20 text-accent-purple'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Upload File
        </button>
        <button
          onClick={() => setActiveTab('google')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'google'
              ? 'bg-accent-cyan/20 text-accent-cyan'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Link className="w-4 h-4" />
          Google Link
        </button>
      </div>

      {activeTab === 'file' ? (
        <>
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer ${
              isDragActive
                ? 'border-accent-cyan bg-accent-cyan/10 shadow-neon'
                : 'border-dark-700 hover:border-accent-purple bg-dark-800/50 backdrop-blur-sm hover:shadow-glow-purple'
            }`}
          >
            <input {...getInputProps()} />
            <div className="text-center">
              <Upload
                className={`mx-auto h-12 w-12 transition-colors ${
                  isDragActive ? 'text-accent-cyan' : 'text-gray-400'
                }`}
              />
              <p className="mt-2 text-sm font-medium text-gray-100">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                or click to browse
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Supported: PDF, DOCX, TXT, PNG, JPG, XLSX, CSV (max 10MB)
              </p>
            </div>
          </div>

          {/* Uploading files */}
          {uploadingFiles.length > 0 && (
            <div className="bg-dark-800/50 backdrop-blur-sm rounded-xl border border-dark-700 divide-y divide-dark-700">
              {uploadingFiles.map((file) => (
                <div key={file.name} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      <File className="w-8 h-8 text-accent-purple" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center space-x-2">
                      {file.status === 'uploading' && (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin text-accent-cyan" />
                          <span className="text-sm text-gray-400">{file.progress}%</span>
                        </>
                      )}
                      {file.status === 'success' && (
                        <CheckCircle className="w-5 h-5 text-accent-green" />
                      )}
                      {file.status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      )}
                      {file.status !== 'uploading' && (
                        <button
                          onClick={() => removeFile(file.name)}
                          className="p-1 hover:bg-dark-700 rounded transition-all hover:scale-110"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {file.status === 'uploading' && (
                    <div className="mt-2 bg-dark-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-accent-cyan to-accent-purple h-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {file.status === 'error' && (
                    <p className="mt-2 text-xs text-red-400">{file.error}</p>
                  )}

                  {/* Processing message */}
                  {file.status === 'success' && (
                    <p className="mt-2 text-xs text-gray-500">
                      Processing document with AI...
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Google Docs/Sheets input */
        <div className="bg-dark-800/50 backdrop-blur-sm rounded-2xl border border-dark-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-accent-cyan/20 rounded-lg">
              {urlType === 'sheet' ? (
                <FileSpreadsheet className="w-6 h-6 text-green-400" />
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <path fill="#A1C2FA" d="M14 2v6h6"/>
                  <path fill="#fff" d="M8 13h8v1H8zm0 3h8v1H8zm0-6h4v1H8z"/>
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-100">Add Google Doc or Sheet</h3>
              <p className="text-xs text-gray-500">
                Paste a link to a public Google Doc or Sheet
              </p>
            </div>
          </div>

          <form onSubmit={handleGoogleSubmit} className="space-y-3">
            <div>
              <input
                type="url"
                value={googleUrl}
                onChange={(e) => setGoogleUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/... or /spreadsheets/d/..."
                className="w-full px-4 py-3 bg-dark-900/50 border border-dark-700 rounded-lg text-gray-100 placeholder-gray-500 focus:border-accent-cyan focus:outline-none"
              />
              {googleError && (
                <p className="mt-2 text-xs text-red-400">{googleError}</p>
              )}
              {urlType && (
                <p className="mt-2 text-xs text-accent-cyan">
                  Detected: Google {urlType === 'sheet' ? 'Sheets' : 'Docs'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!googleUrl.trim() || googleMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-cyan/20 text-accent-cyan rounded-lg hover:bg-accent-cyan/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding & fetching name...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  Add Google {urlType === 'sheet' ? 'Sheet' : 'Doc'}
                </>
              )}
            </button>
          </form>

          <div className="mt-4 p-3 bg-dark-900/50 rounded-lg">
            <p className="text-xs text-gray-400">
              <strong className="text-gray-300">Note:</strong> The document must be set to{' '}
              <span className="text-accent-cyan">"Anyone with the link can view"</span>{' '}
              in sharing settings.
            </p>
          </div>

          {/* Success message with document name */}
          {addedDoc && (
            <div className="mt-4 p-4 bg-accent-green/10 border border-accent-green/20 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-accent-green flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-accent-green">Added successfully!</p>
                  <p className="text-sm text-gray-300 truncate flex items-center gap-2 mt-1">
                    {addedDoc.type === 'google_sheet' ? (
                      <FileSpreadsheet className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{addedDoc.name}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
