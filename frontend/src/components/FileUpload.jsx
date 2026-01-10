import React, { useState, useRef } from 'react';
import { useTheme } from '../ThemeContext';

const ALLOWED_AUDIO = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac'];
const ALLOWED_IMAGE = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

export default function FileUpload({ onUploadComplete, onImportComplete, onBackToProjects }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState('new');
  const [audioFile, setAudioFile] = useState(null);
  const [alignmentAudioFile, setAlignmentAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [lyrics, setLyrics] = useState('');
  const [timingFile, setTimingFile] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const [showAlignmentAudio, setShowAlignmentAudio] = useState(false);

  const audioInputRef = useRef(null);
  const alignmentAudioInputRef = useRef(null);
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

  const handleAlignmentAudioSelect = (file) => {
    if (file && ALLOWED_AUDIO.includes(getExtension(file.name))) {
      setAlignmentAudioFile(file);
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
    else if (type === 'alignmentAudio') handleAlignmentAudioSelect(file);
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
      onUploadComplete({ audioFile, alignmentAudioFile, imageFile, lyrics });
    } else if (mode === 'import' && isValidImport && onImportComplete) {
      onImportComplete({ audioFile, imageFile, timingFile });
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center px-8 py-8">
      {/* Back button */}
      {onBackToProjects && (
        <div className="w-full max-w-2xl mb-6">
          <button
            onClick={onBackToProjects}
            className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back to Projects</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-light text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>
            Upload Your Files
          </h1>
          <p className="text-white/40">Upload an audio file, choose a background image, and paste your lyrics.</p>
        </div>

        {/* Tab buttons */}
        <div className="flex justify-center gap-2 mb-10">
          <button
            onClick={() => setMode('new')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
              mode === 'new'
                ? 'text-white shadow-lg'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
            }`}
            style={mode === 'new' ? { background: theme.primary, boxShadow: `0 10px 15px -3px ${theme.glow2}` } : {}}
          >
            New Project
          </button>
          <button
            onClick={() => setMode('import')}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
              mode === 'import'
                ? 'text-white shadow-lg'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
            }`}
            style={mode === 'import' ? { background: theme.primary, boxShadow: `0 10px 15px -3px ${theme.glow2}` } : {}}
          >
            Import Timing JSON
          </button>
        </div>

        {/* Upload sections */}
        <div className="space-y-6">
          {/* Audio File */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-3 ml-1">Audio File</label>
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
              className="group relative p-8 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer bg-white/[0.02]"
              style={{
                borderColor: dragTarget === 'audio' || audioFile ? theme.uploadHover1 : 'rgba(255,255,255,0.1)',
                backgroundColor: dragTarget === 'audio' || audioFile ? `${theme.accent1}08` : undefined
              }}
            >
              {audioFile ? (
                <div className="flex items-center justify-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${theme.bgAccent}, ${theme.bgAccent2})` }}>
                    <svg className="w-7 h-7" style={{ color: theme.uploadIcon1 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">{audioFile.name}</p>
                    <p className="text-white/40 text-sm">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAudioFile(null); }}
                    className="ml-4 p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300" style={{ background: `linear-gradient(to bottom right, ${theme.bgAccent}, ${theme.bgAccent2})` }}>
                    <svg className="w-8 h-8" style={{ color: theme.uploadIcon1 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                  <p className="text-white/60 mb-1">
                    Drop audio file here or <span style={{ color: theme.uploadIcon1 }}>browse</span>
                  </p>
                  <p className="text-white/30 text-sm">MP3, WAV, M4A, FLAC supported</p>
                </div>
              )}
            </div>
          </div>

          {/* Alignment Audio (Optional) - Only show in new mode */}
          {mode === 'new' && (
            <div>
              <div className="flex items-center justify-between mb-3 ml-1">
                <label className="text-white/70 text-sm font-medium">
                  Alignment Audio <span className="text-white/40 font-normal">(Optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowAlignmentAudio(!showAlignmentAudio);
                    if (showAlignmentAudio) setAlignmentAudioFile(null);
                  }}
                  className="text-xs px-3 py-1 rounded-lg transition-colors"
                  style={{
                    background: showAlignmentAudio ? `${theme.accent1}20` : 'rgba(255,255,255,0.05)',
                    color: showAlignmentAudio ? theme.accent1 : 'rgba(255,255,255,0.5)'
                  }}
                >
                  {showAlignmentAudio ? 'Remove' : '+ Add vocals track'}
                </button>
              </div>

              {showAlignmentAudio && (
                <>
                  <p className="text-white/40 text-xs mb-3 ml-1">
                    Upload a vocals-only track for better transcription accuracy. The main audio will be used in the final video.
                  </p>
                  <input
                    type="file"
                    ref={alignmentAudioInputRef}
                    onChange={(e) => handleAlignmentAudioSelect(e.target.files[0])}
                    accept={ALLOWED_AUDIO.map(ext => `.${ext}`).join(',')}
                    className="hidden"
                  />
                  <div
                    onClick={() => alignmentAudioInputRef.current?.click()}
                    onDrop={(e) => handleDrop(e, 'alignmentAudio')}
                    onDragOver={(e) => handleDragOver(e, 'alignmentAudio')}
                    onDragLeave={handleDragLeave}
                    className="group relative p-6 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer bg-white/[0.02]"
                    style={{
                      borderColor: dragTarget === 'alignmentAudio' || alignmentAudioFile ? theme.accent3 : 'rgba(255,255,255,0.1)',
                      backgroundColor: dragTarget === 'alignmentAudio' || alignmentAudioFile ? `${theme.accent3}08` : undefined
                    }}
                  >
                    {alignmentAudioFile ? (
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${theme.glow3}, ${theme.bgAccent2})` }}>
                          <svg className="w-6 h-6" style={{ color: theme.accent3 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <p className="text-white font-medium text-sm">{alignmentAudioFile.name}</p>
                          <p className="text-white/40 text-xs">{(alignmentAudioFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setAlignmentAudioFile(null); }}
                          className="ml-4 p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300" style={{ background: `linear-gradient(to bottom right, ${theme.glow3}, ${theme.bgAccent2})` }}>
                          <svg className="w-6 h-6" style={{ color: theme.accent3 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </div>
                        <p className="text-white/60 text-sm mb-1">
                          Drop vocals-only file here or <span style={{ color: theme.accent3 }}>browse</span>
                        </p>
                        <p className="text-white/30 text-xs">Isolated vocals for better word detection</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Background Image */}
          <div>
            <label className="block text-white/70 text-sm font-medium mb-3 ml-1">Background Image</label>
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
              className="group relative p-8 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer bg-white/[0.02]"
              style={{
                borderColor: dragTarget === 'image' || imageFile ? theme.uploadHover2 : 'rgba(255,255,255,0.1)',
                backgroundColor: dragTarget === 'image' || imageFile ? `${theme.accent2}08` : undefined
              }}
            >
              {imageFile ? (
                <div className="flex items-center justify-center gap-4">
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="h-14 w-20 object-cover rounded-lg" />
                  )}
                  <div className="text-left">
                    <p className="text-white font-medium">{imageFile.name}</p>
                    <p className="text-white/40 text-sm">{(imageFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                    className="ml-4 p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300" style={{ background: `linear-gradient(to bottom right, ${theme.bgAccent2}, ${theme.glow3})` }}>
                    <svg className="w-8 h-8" style={{ color: theme.uploadIcon2 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-white/60 mb-1">
                    Drop image here or <span style={{ color: theme.uploadIcon2 }}>browse</span>
                  </p>
                  <p className="text-white/30 text-sm">JPG, PNG, WebP supported</p>
                </div>
              )}
            </div>
          </div>

          {/* Lyrics (New mode) */}
          {mode === 'new' && (
            <div>
              <label className="block text-white/70 text-sm font-medium mb-3 ml-1">Lyrics</label>
              <div className="relative">
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="Paste your lyrics here...

Each line should be on its own line.
Empty lines will create pauses."
                  className="w-full h-48 px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 resize-none focus:outline-none focus:bg-white/[0.05] transition-all duration-300"
                  style={{ fontFamily: 'Georgia, serif', borderColor: lyrics ? theme.uploadHover2 : undefined }}
                />
                {lyrics.trim() && (
                  <div className="absolute bottom-4 right-4 text-white/20 text-sm">
                    {lyrics.split('\n').filter(l => l.trim()).length} lines
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timing JSON (Import mode) */}
          {mode === 'import' && (
            <div>
              <label className="block text-white/70 text-sm font-medium mb-3 ml-1">Timing JSON File</label>
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
                className="group relative p-8 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer bg-white/[0.02]"
                style={{
                  borderColor: dragTarget === 'timing' || timingFile ? theme.accent3 : 'rgba(255,255,255,0.1)',
                  backgroundColor: dragTarget === 'timing' || timingFile ? `${theme.accent3}08` : undefined
                }}
              >
                {timingFile ? (
                  <div className="flex items-center justify-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${theme.glow3}, ${theme.bgAccent2})` }}>
                      <svg className="w-7 h-7" style={{ color: theme.accent3 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-white font-medium">{timingFile.name}</p>
                      <p className="text-white/40 text-sm">{(timingFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTimingFile(null); }}
                      className="ml-4 p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300" style={{ background: `linear-gradient(to bottom right, ${theme.glow3}, ${theme.bgAccent2})` }}>
                      <svg className="w-8 h-8" style={{ color: theme.accent3 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-white/60 mb-1">
                      Drop timing JSON here or <span style={{ color: theme.accent3 }}>browse</span>
                    </p>
                    <p className="text-white/30 text-sm">Previously exported timing JSON file</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Continue button */}
        <div className="mt-10 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={mode === 'new' ? !isValidNew : !isValidImport}
            className="group relative px-8 py-4 rounded-2xl font-medium text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
            style={{ background: theme.primary, boxShadow: `0 25px 50px -12px ${theme.glow2}` }}
          >
            <span className="relative z-10 flex items-center gap-2">
              {mode === 'new'
                ? (isValidNew ? 'Start Processing' : 'Add all files to continue')
                : (isValidImport ? 'Import & Edit' : 'Add all files to continue')}
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </button>
        </div>
      </div>
    </main>
  );
}
