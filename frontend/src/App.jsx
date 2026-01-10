import React, { useState } from 'react';
import TimelineEditor from './components/TimelineEditor';
import FileUpload from './components/FileUpload';
import StylePanel from './components/StylePanel';
import VideoPreview from './components/VideoPreview';
import PreviewEditor from './components/PreviewEditor';
import ProjectList from './components/ProjectList';
import SaveProjectModal from './components/SaveProjectModal';
import { useTheme } from './ThemeContext';
import {
  uploadFiles,
  alignLyrics,
  updateTiming,
  generateVideo,
  getDownloadUrl,
  getAudioUrl,
  getWaveform,
  deleteJob,
  importTimingFiles,
  openProject,
  createProject,
  updateProject,
  getProjectImageUrl,
} from './api';

const STEPS = {
  PROJECTS: 'projects',
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  EDIT: 'edit',
  GENERATE: 'generate',
  DOWNLOAD: 'download',
};

const EDIT_TABS = {
  TIMELINE: 'timeline',
  PREVIEW: 'preview',
};

const DEFAULT_SETTINGS = {
  fontSize: 60,
  textColor: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 3,
  resolution: '1920x1080',
  orientation: 'horizontal',
  font: 'Arial',
  textBox: null,
};

function App() {
  const { theme, toggleTheme, themes } = useTheme();
  const [currentStep, setCurrentStep] = useState(STEPS.PROJECTS);
  const [editTab, setEditTab] = useState(EDIT_TABS.PREVIEW);
  const [jobId, setJobId] = useState(null);
  const [timingData, setTimingData] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [videoUrl, setVideoUrl] = useState(null);
  const [waveformPeaks, setWaveformPeaks] = useState(null);
  const [error, setError] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('');

  // Project state
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [currentProjectName, setCurrentProjectName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleUploadComplete = async ({ audioFile, imageFile, lyrics }) => {
    setError(null);
    setCurrentStep(STEPS.PROCESSING);
    setProcessingStatus('Uploading files...');

    // Store image URL for preview
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => setImageUrl(e.target.result);
      reader.readAsDataURL(imageFile);
    }

    try {
      // Upload files
      const uploadResult = await uploadFiles(audioFile, imageFile, lyrics);
      setJobId(uploadResult.job_id);
      setProcessingStatus('Analyzing audio and aligning lyrics... This may take 30-120 seconds.');

      // Start alignment (synchronous - waits for completion)
      const alignResult = await alignLyrics(uploadResult.job_id);
      setTimingData(alignResult.timing);
      // Extract waveform if available
      if (alignResult.waveform) {
        setWaveformPeaks(alignResult.waveform.peaks);
      }
      setCurrentStep(STEPS.EDIT);
    } catch (err) {
      setError(err.message || 'Failed to process files');
      setCurrentStep(STEPS.UPLOAD);
    }
  };

  const handleImportComplete = async ({ audioFile, imageFile, timingFile }) => {
    setError(null);
    setCurrentStep(STEPS.PROCESSING);
    setProcessingStatus('Importing files...');

    // Store image URL for preview
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (e) => setImageUrl(e.target.result);
      reader.readAsDataURL(imageFile);
    }

    try {
      const result = await importTimingFiles(audioFile, imageFile, timingFile);
      setJobId(result.job_id);
      setTimingData(result.timing);
      // Fetch waveform in background for imported files
      getWaveform(result.job_id)
        .then((wf) => setWaveformPeaks(wf.peaks))
        .catch((err) => console.log('Waveform not available:', err));
      setCurrentStep(STEPS.EDIT);
    } catch (err) {
      setError(err.message || 'Failed to import files');
      setCurrentStep(STEPS.UPLOAD);
    }
  };

  const handleTimingUpdate = async (newTiming) => {
    setTimingData(newTiming);
    if (jobId) {
      try {
        await updateTiming(jobId, newTiming);
      } catch (err) {
        console.error('Failed to save timing:', err);
      }
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setCurrentStep(STEPS.GENERATE);

    try {
      const result = await generateVideo(jobId, settings);
      setVideoUrl(result.download_url);
      setCurrentStep(STEPS.DOWNLOAD);
    } catch (err) {
      setError(err.message || 'Failed to generate video');
      setCurrentStep(STEPS.EDIT);
    }
  };

  const resetState = () => {
    setCurrentStep(STEPS.PROJECTS);
    setEditTab(EDIT_TABS.PREVIEW);
    setJobId(null);
    setTimingData(null);
    setImageUrl(null);
    setSettings({ ...DEFAULT_SETTINGS });
    setVideoUrl(null);
    setWaveformPeaks(null);
    setError(null);
    setCurrentProjectId(null);
    setCurrentProjectName('');
  };

  const handleReset = async () => {
    if (jobId) {
      try {
        await deleteJob(jobId);
      } catch (err) {
        console.error('Failed to clean up job:', err);
      }
    }
    resetState();
  };

  const handleCancelProcessing = async () => {
    if (jobId) {
      try {
        await deleteJob(jobId);
      } catch (err) {
        console.error('Failed to cancel:', err);
      }
    }
    setJobId(null);
    setCurrentStep(STEPS.UPLOAD);
  };

  // Project handlers
  const handleOpenProject = async (projectId) => {
    setError(null);
    setCurrentStep(STEPS.PROCESSING);
    setProcessingStatus('Opening project...');

    try {
      const result = await openProject(projectId);
      setJobId(result.job_id);
      setCurrentProjectId(projectId);
      setCurrentProjectName(result.name || '');
      setTimingData(result.timing);

      // Load settings if available, otherwise use defaults
      if (result.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.settings });
      }

      // Load waveform if available
      if (result.waveform?.peaks) {
        setWaveformPeaks(result.waveform.peaks);
      }

      // Load image from project
      setImageUrl(getProjectImageUrl(projectId));

      setCurrentStep(STEPS.EDIT);
    } catch (err) {
      setError(err.message || 'Failed to open project');
      setCurrentStep(STEPS.PROJECTS);
    }
  };

  const handleNewProject = () => {
    // Clear any existing state and go to upload
    setCurrentProjectId(null);
    setCurrentProjectName('');
    setJobId(null);
    setTimingData(null);
    setImageUrl(null);
    setSettings({ ...DEFAULT_SETTINGS });
    setVideoUrl(null);
    setWaveformPeaks(null);
    setError(null);
    setCurrentStep(STEPS.UPLOAD);
  };

  const handleBackToProjects = () => {
    // If there's an active job without a saved project, clean it up
    if (jobId && !currentProjectId) {
      deleteJob(jobId).catch((err) =>
        console.error('Failed to clean up job:', err)
      );
    }
    resetState();
  };

  const handleSaveProject = async (projectName) => {
    if (!jobId) return;

    setIsSaving(true);
    try {
      if (currentProjectId) {
        // Update existing project
        await updateProject(currentProjectId, {
          name: projectName,
          timing: timingData,
          settings,
        });
        setCurrentProjectName(projectName);
      } else {
        // Create new project
        const result = await createProject(
          projectName,
          jobId,
          settings,
          waveformPeaks ? { peaks: waveformPeaks } : null
        );
        setCurrentProjectId(result.project.id);
        setCurrentProjectName(projectName);
      }
      setShowSaveModal(false);
    } catch (err) {
      setError(err.message || 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickSave = async () => {
    if (!currentProjectId || !jobId) return;

    try {
      await updateProject(currentProjectId, {
        timing: timingData,
        settings,
      });
    } catch (err) {
      setError(err.message || 'Failed to save project');
    }
  };

  // Steps to show in header (excluding PROJECTS)
  const headerSteps = Object.values(STEPS).filter((s) => s !== STEPS.PROJECTS);

  return (
    <div className="min-h-screen text-white flex flex-col" style={{
      background: theme.background
    }}>
      {/* Floating decorative elements */}
      <div className="fixed top-1/4 left-10 w-64 h-64 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: theme.glow1 }} />
      <div className="fixed bottom-1/4 right-10 w-80 h-80 rounded-full blur-3xl pointer-events-none" style={{ backgroundColor: theme.glow2 }} />

      {/* Header */}
      <header className="px-8 py-6 border-b border-white/5 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: theme.primary, boxShadow: `0 10px 15px -3px ${theme.glow2}` }}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: theme.pulseDot }} />
              </div>
              <span className="text-xl font-light tracking-wide text-white/90" style={{ fontFamily: 'Georgia, serif' }}>
                Lyrics Video <span className="font-normal text-transparent bg-clip-text" style={{ backgroundImage: theme.textGradient }}>Generator</span>
              </span>
            </div>
            {currentStep !== STEPS.PROJECTS && currentProjectName && (
              <span className="text-white/40 text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                — {currentProjectName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 group"
              title={`Switch to ${theme.id === 'purple' ? 'Sage Garden' : 'Purple Dream'} theme`}
            >
              {theme.id === 'purple' ? (
                <svg className="w-5 h-5 text-white/60 group-hover:text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white/60 group-hover:text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
              )}
            </button>

            {/* Step Indicator (only show when not on projects page) */}
            {currentStep !== STEPS.PROJECTS && (
              <div className="flex items-center gap-2 text-sm">
                {headerSteps.map((step, i) => (
                  <React.Fragment key={step}>
                    <div
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                        currentStep === step
                          ? ''
                          : headerSteps.indexOf(currentStep) > i
                          ? 'bg-green-500/20 border border-green-500/30'
                          : 'opacity-40'
                      }`}
                      style={currentStep === step ? {
                        background: `linear-gradient(to right, ${theme.bgAccent}, ${theme.bgAccent2})`,
                        border: `1px solid ${theme.borderAccent}`
                      } : {}}
                    >
                      <span className={`text-sm ${currentStep === step ? 'text-white' : 'text-white/60'}`}>
                        {step.charAt(0).toUpperCase() + step.slice(1)}
                      </span>
                    </div>
                    {i < headerSteps.length - 1 && (
                      <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3 relative z-10">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-red-300">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {currentStep === STEPS.PROJECTS && (
          <ProjectList
            onOpenProject={handleOpenProject}
            onNewProject={handleNewProject}
          />
        )}

        {currentStep === STEPS.UPLOAD && (
          <FileUpload
            onUploadComplete={handleUploadComplete}
            onImportComplete={handleImportComplete}
            onBackToProjects={handleBackToProjects}
          />
        )}

        {currentStep === STEPS.PROCESSING && (
          <div className="flex-1 flex items-center justify-center relative z-10">
            <div className="max-w-md text-center p-8">
              <div className="relative p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                <div className="relative mb-8">
                  <div className="w-20 h-20 mx-auto rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: theme.accent2, borderTopColor: 'transparent' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full" style={{ background: `linear-gradient(to bottom right, ${theme.glow1}, ${theme.glow2})` }} />
                  </div>
                </div>
                <h2 className="text-2xl font-light text-white mb-3" style={{ fontFamily: 'Georgia, serif' }}>
                  Processing Audio...
                </h2>
                <p className="text-white/50 mb-6">{processingStatus}</p>
                <button
                  onClick={handleCancelProcessing}
                  className="text-white/40 hover:text-white/80 text-sm transition-colors"
                >
                  Cancel
                </button>
                <div className="absolute -inset-4 rounded-full blur-2xl opacity-50 -z-10" style={{ background: `linear-gradient(to right, ${theme.glow1}, ${theme.glow2}, ${theme.glow3})` }} />
              </div>
            </div>
          </div>
        )}

        {currentStep === STEPS.EDIT && (
          <div className="flex-1 flex flex-col relative z-10">
            {/* Tab Switcher with Project Actions */}
            <div className="bg-white/[0.02] border-b border-white/5 px-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditTab(EDIT_TABS.PREVIEW)}
                    className={`px-5 py-3 text-sm font-medium rounded-t-xl transition-all duration-300 ${
                      editTab === EDIT_TABS.PREVIEW
                        ? 'text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                    style={editTab === EDIT_TABS.PREVIEW ? {
                      background: `linear-gradient(to right, ${theme.bgAccent}, ${theme.bgAccent2})`,
                      borderBottom: `2px solid ${theme.accent1}`
                    } : {}}
                  >
                    Preview & Style
                  </button>
                  <button
                    onClick={() => setEditTab(EDIT_TABS.TIMELINE)}
                    className={`px-5 py-3 text-sm font-medium rounded-t-xl transition-all duration-300 ${
                      editTab === EDIT_TABS.TIMELINE
                        ? 'text-white'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                    style={editTab === EDIT_TABS.TIMELINE ? {
                      background: `linear-gradient(to right, ${theme.bgAccent}, ${theme.bgAccent2})`,
                      borderBottom: `2px solid ${theme.accent1}`
                    } : {}}
                  >
                    Timeline Editor
                  </button>
                </div>

                {/* Project Actions */}
                <div className="flex items-center gap-2 py-2">
                  <button
                    onClick={handleBackToProjects}
                    className="px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors"
                  >
                    My Projects
                  </button>
                  {currentProjectId ? (
                    <>
                      <button
                        onClick={handleQuickSave}
                        className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-300"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowSaveModal(true)}
                        className="px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors"
                      >
                        Save As...
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="px-4 py-2 text-sm font-medium text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg"
                      style={{ background: theme.primary, boxShadow: `0 10px 15px -3px ${theme.glow2}` }}
                    >
                      Save Project
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 flex flex-col">
              {editTab === EDIT_TABS.PREVIEW ? (
                <PreviewEditor
                  imageUrl={imageUrl}
                  audioUrl={jobId ? getAudioUrl(jobId) : null}
                  timingData={timingData}
                  settings={settings}
                  onSettingsChange={setSettings}
                  onGenerate={handleGenerate}
                  isGenerating={currentStep === STEPS.GENERATE}
                />
              ) : (
                <>
                  <StylePanel settings={settings} onChange={setSettings} />
                  <div className="flex-1">
                    <TimelineEditor
                      initialData={timingData}
                      onTimingChange={handleTimingUpdate}
                      onGenerate={handleGenerate}
                      audioUrl={jobId ? getAudioUrl(jobId) : null}
                      waveformPeaks={waveformPeaks}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {currentStep === STEPS.GENERATE && (
          <div className="flex-1 flex items-center justify-center relative z-10">
            <div className="max-w-md text-center p-8">
              <div className="relative p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                <div className="relative mb-8">
                  <div className="w-20 h-20 mx-auto rounded-full border-4 border-green-500 border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20" />
                  </div>
                </div>
                <h2 className="text-2xl font-light text-white mb-3" style={{ fontFamily: 'Georgia, serif' }}>
                  Generating Video...
                </h2>
                <p className="text-white/50">
                  Rendering your lyrics video. This may take a minute.
                </p>
                <div className="absolute -inset-4 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 rounded-full blur-2xl opacity-50 -z-10" />
              </div>
            </div>
          </div>
        )}

        {currentStep === STEPS.DOWNLOAD && (
          <VideoPreview videoUrl={videoUrl} onReset={handleReset} />
        )}
      </main>

      {/* Save Project Modal */}
      <SaveProjectModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveProject}
        defaultName={currentProjectName || timingData?.title || ''}
        isUpdate={!!currentProjectId}
        saving={isSaving}
      />
    </div>
  );
}

export default App;
