import React, { useState, useEffect } from 'react';
import { listProjects, deleteProject, getProjectImageUrl } from '../api';
import { useTheme } from '../ThemeContext';

export default function ProjectList({ onOpenProject, onNewProject }) {
  const { theme } = useTheme();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await listProjects();
      setProjects(result.projects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, projectId, projectName) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${projectName}"? This cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(projectId);
      await deleteProject(projectId);
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err) {
      setError(`Failed to delete: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Generate gradient border style from theme
  const gradientBorder = `linear-gradient(135deg, ${theme.accent1}4D 0%, ${theme.accent2}4D 50%, ${theme.accent3}4D 100%)`;

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-light text-white mb-2" style={{ fontFamily: 'Georgia, serif' }}>
          My Projects
        </h1>
        <p className="text-white/40 text-sm tracking-wide">Create beautiful lyrics videos</p>
      </div>

      {error && (
        <div className="mb-6 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 max-w-md text-center">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: theme.accent2, borderTopColor: 'transparent' }} />
          <p className="text-white/40">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center">
          {/* Decorative element */}
          <div className="relative mb-8">
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-14 h-14 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="absolute -inset-4 rounded-full blur-2xl opacity-50" style={{ background: `linear-gradient(to right, ${theme.glow1}, ${theme.glow2}, ${theme.glow3})` }} />
          </div>

          <p className="text-white/50 text-lg mb-2" style={{ fontFamily: 'Georgia, serif' }}>No projects yet</p>
          <p className="text-white/30 text-sm mb-8">Create your first lyrics video project</p>

          <button
            onClick={onNewProject}
            className="group relative px-8 py-4 rounded-2xl font-medium text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl"
            style={{ background: theme.primary, boxShadow: `0 25px 50px -12px ${theme.glow2}` }}
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Project
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </button>
        </div>
      ) : (
        <div className="w-full max-w-4xl">
          {/* New Project Button */}
          <div className="flex justify-end mb-6">
            <button
              onClick={onNewProject}
              className="group relative px-6 py-3 rounded-xl font-medium text-white overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl"
              style={{ background: theme.primary, boxShadow: `0 10px 15px -3px ${theme.glow2}` }}
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Project
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </button>
          </div>

          {/* Project Grid */}
          <div className="grid gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => onOpenProject(project.id)}
                className="group relative p-1 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                style={{ background: gradientBorder }}
              >
                <div className="flex items-stretch rounded-xl overflow-hidden" style={{ backgroundColor: theme.id === 'sage' ? '#1a2e1f' : '#1a1333' }}>
                  {/* Thumbnail */}
                  <div className="w-36 h-24 flex-shrink-0" style={{ background: `linear-gradient(to bottom right, ${theme.glow2}, ${theme.glow3})` }}>
                    <img
                      src={getProjectImageUrl(project.id)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 p-4 flex flex-col justify-center">
                    <h3 className="text-lg font-medium text-white mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                      {project.name}
                    </h3>
                    <p className="text-sm text-white/40">
                      {formatDate(project.updated_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 p-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProject(project.id);
                      }}
                      className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-all duration-300"
                    >
                      Open
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, project.id, project.name)}
                      disabled={deletingId === project.id}
                      className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300 disabled:opacity-50"
                      title="Delete project"
                    >
                      {deletingId === project.id ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
