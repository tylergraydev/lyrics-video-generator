import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';

export default function SaveProjectModal({
  isOpen,
  onClose,
  onSave,
  defaultName = '',
  isUpdate = false,
  saving = false,
}) {
  const { theme } = useTheme();
  const [projectName, setProjectName] = useState(defaultName);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setProjectName(defaultName);
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = projectName.trim();
    if (name) {
      onSave(name);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Generate gradient border from theme
  const gradientBorder = `linear-gradient(135deg, ${theme.accent1}80 0%, ${theme.accent2}80 50%, ${theme.accent3}80 100%)`;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="relative w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient border wrapper */}
        <div
          className="p-[1px] rounded-3xl"
          style={{ background: gradientBorder }}
        >
          <div
            className="rounded-3xl p-8"
            style={{ background: theme.background }}
          >
            <h2 className="text-2xl font-light text-white mb-6" style={{ fontFamily: 'Georgia, serif' }}>
              {isUpdate ? 'Update Project' : 'Save Project'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-8">
                <label
                  htmlFor="projectName"
                  className="block text-sm font-medium text-white/60 mb-3 ml-1"
                >
                  Project Name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Lyrics Video"
                  className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white placeholder-white/30 focus:bg-white/[0.05] outline-none transition-all duration-300"
                  style={{ fontFamily: 'Georgia, serif', borderColor: projectName ? theme.uploadHover2 : undefined }}
                  disabled={saving}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-6 py-3 text-white/50 hover:text-white/80 transition-colors disabled:opacity-50 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!projectName.trim() || saving}
                  className="group relative px-8 py-3 rounded-xl font-medium text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100"
                  style={{ background: theme.primary, boxShadow: `0 10px 15px -3px ${theme.glow2}` }}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {saving && (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    )}
                    {saving ? 'Saving...' : isUpdate ? 'Update' : 'Save'}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Decorative glow */}
        <div className="absolute -inset-4 rounded-full blur-3xl opacity-50 -z-10" style={{ background: `linear-gradient(to right, ${theme.glow1}, ${theme.glow2}, ${theme.glow3})` }} />
      </div>
    </div>
  );
}
