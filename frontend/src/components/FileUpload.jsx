import React, { useState, useRef } from 'react';

const ALLOWED_AUDIO = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'];
const ALLOWED_IMAGE = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

export default function FileUpload({ onUploadComplete }) {
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [lyrics, setLyrics] = useState('');
  const [dragTarget, setDragTarget] = useState(null);

  const audioInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const isValid = audioFile && imageFile && lyrics.trim().length > 0;

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

  const handleDrop = (e, type) => {
    e.preventDefault();
    setDragTarget(null);
    const file = e.dataTransfer.files[0];
    if (type === 'audio') handleAudioSelect(file);
    else if (type === 'image') handleImageSelect(file);
  };

  const handleDragOver = (e, type) => {
    e.preventDefault();
    setDragTarget(type);
  };

  const handleDragLeave = () => {
    setDragTarget(null);
  };

  const handleSubmit = () => {
    if (isValid && onUploadComplete) {
      onUploadComplete({ audioFile, imageFile, lyrics });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-gray-800 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-2 text-center">Upload Your Files</h2>
        <p className="text-gray-400 mb-8 text-center">
          Upload an audio file, choose a background image, and paste your lyrics.
        </p>

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

          {/* Lyrics Input */}
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

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className={`w-full py-3 rounded-lg font-medium transition-colors
              ${isValid
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
          >
            {isValid ? 'Start Processing →' : 'Add all files to continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
