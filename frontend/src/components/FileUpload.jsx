import React, { useState, useRef } from 'react';

const ALLOWED_AUDIO = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'];
const ALLOWED_IMAGE = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

export default function FileUpload({ onUploadComplete, onImportComplete }) {
  const [mode, setMode] = useState('new'); // 'new' or 'import'
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [lyrics, setLyrics] = useState('');
  const [timingFile, setTimingFile] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);

  const audioInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const timingInputRef = useRef(null);

  const isValidNew = audioFile && imageFile && lyrics.trim().length > 0;
  const isValidImport = audioFile && imageFile && timingFile;

  const getExtension = (filename) => {
    return filename?.split('.').pop()?.toLowerCase() || '';
  };

  const handleAudioSelect = (file) => {
    if (file && ALLOWED_AUDIO.includes(getExtension(file.name))) {
      setAudioFile(file);
    }
  };

  const handleImageSelect = (file) => {
    if (file && ALLOWED_IMAGE.includes(getExtension(file.name))) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleTimingSelect = (file) => {
    if (file && getExtension(file.name) === 'json') {
      setTimingFile(file);
    }
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    setDragTarget(null);
    const file = e.dataTransfer.files[0];
    if (type === 'audio') handleAudioSelect(file);
    else if (type === 'image') handleImageSelect(file);
    else if (type === 'timing') handleTimingSelect(file);
  };

  const handleDragOver = (e, type) => {
    e.preventDefault();
    setDragTarget(type);
  };

  const handleDragLeave = () => {
    setDragTarget(null);
  };

  const handleSubmit = () => {
    if (mode === 'new' && isValidNew && onUploadComplete) {
      onUploadComplete({ audioFile, imageFile, lyrics });
    } else if (mode === 'import' && isValidImport && onImportComplete) {
      onImportComplete({ audioFile, imageFile, timingFile });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-gray-800 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-2 text-center">Upload Your Files</h2>
        <p className="text-gray-400 mb-4 text-center">
          Upload an audio file, choose a background image, and paste your lyrics.
        </p>

        {/* Mode Toggle */}
        <div className="flex justify-center gap-2 mb-8">
          <button
            onClick={() => setMode('new')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'new'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            New Project
          </button>
          <button
            onClick={() => setMode('import')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'import'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Import Timing JSON
          </button>
        </div>

        <div className="space-y-6">
          {/* Audio Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Audio File
            </label>
            <input
              type="file"
              ref={audioInputRef}
              onChange={(e) => handleAudioSelect(e.target.files[0])}
              accept={ALLOWED_AUDIO.map(ext => `.${ext}`).join(',')}
              className="hidden"
            />
            <div
              onClick={() => audioInputRef.current?.click()}
              onDrop={(e) => handleDrop(e, 'audio')}
              onDragOver={(e) => handleDragOver(e, 'audio')}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${dragTarget === 'audio' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}
                ${audioFile ? 'bg-green-900/20 border-green-600' : ''}`}
            >
              {audioFile ? (
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl">🎵</span>
                  <div className="text-left">
                    <p className="text-white font-medium">{audioFile.name}</p>
                    <p className="text-gray-400 text-sm">
                      {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAudioFile(null); }}
                    className="ml-4 text-gray-400 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div>
                  <span className="text-3xl mb-2 block">🎵</span>
                  <p className="text-gray-400">
                    Drop audio file here or <span className="text-blue-400">browse</span>
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    MP3, WAV, M4A, FLAC supported
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Background Image
            </label>
            <input
              type="file"
              ref={imageInputRef}
              onChange={(e) => handleImageSelect(e.target.files[0])}
              accept={ALLOWED_IMAGE.map(ext => `.${ext}`).join(',')}
              className="hidden"
            />
            <div
              onClick={() => imageInputRef.current?.click()}
              onDrop={(e) => handleDrop(e, 'image')}
              onDragOver={(e) => handleDragOver(e, 'image')}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${dragTarget === 'image' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}
                ${imageFile ? 'bg-green-900/20 border-green-600' : ''}`}
            >
              {imageFile ? (
                <div className="flex items-center justify-center gap-4">
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-16 w-24 object-cover rounded"
                    />
                  )}
                  <div className="text-left">
                    <p className="text-white font-medium">{imageFile.name}</p>
                    <p className="text-gray-400 text-sm">
                      {(imageFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="ml-4 text-gray-400 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div>
                  <span className="text-3xl mb-2 block">🖼️</span>
                  <p className="text-gray-400">
                    Drop image here or <span className="text-blue-400">browse</span>
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    JPG, PNG, WebP supported
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Lyrics Input (New mode) */}
          {mode === 'new' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Lyrics
              </label>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="Paste your lyrics here...

Each line should be on its own line.
Empty lines will create pauses."
                className="w-full h-48 bg-gray-700 border border-gray-600 rounded-lg p-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              />
              {lyrics.trim() && (
                <p className="text-gray-500 text-xs mt-1">
                  {lyrics.trim().split('\n').filter(l => l.trim()).length} lines
                </p>
              )}
            </div>
          )}

          {/* Timing JSON Upload (Import mode) */}
          {mode === 'import' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Timing JSON File
              </label>
              <input
                type="file"
                ref={timingInputRef}
                onChange={(e) => handleTimingSelect(e.target.files[0])}
                accept=".json"
                className="hidden"
              />
              <div
                onClick={() => timingInputRef.current?.click()}
                onDrop={(e) => handleDrop(e, 'timing')}
                onDragOver={(e) => handleDragOver(e, 'timing')}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${dragTarget === 'timing' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}
                  ${timingFile ? 'bg-green-900/20 border-green-600' : ''}`}
              >
                {timingFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div className="text-left">
                      <p className="text-white font-medium">{timingFile.name}</p>
                      <p className="text-gray-400 text-sm">
                        {(timingFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTimingFile(null); }}
                      className="ml-4 text-gray-400 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl mb-2 block">📄</span>
                    <p className="text-gray-400">
                      Drop timing JSON here or <span className="text-blue-400">browse</span>
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Previously exported timing JSON file
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={mode === 'new' ? !isValidNew : !isValidImport}
            className={`w-full py-3 rounded-lg font-medium transition-colors
              ${(mode === 'new' ? isValidNew : isValidImport)
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
          >
            {mode === 'new'
              ? (isValidNew ? 'Start Processing →' : 'Add all files to continue')
              : (isValidImport ? 'Import & Edit →' : 'Add all files to continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
