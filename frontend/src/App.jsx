import React, { useState } from 'react';
import TimelineEditor from './components/TimelineEditor';
import FileUpload from './components/FileUpload';
import StylePanel from './components/StylePanel';
import VideoPreview from './components/VideoPreview';
import PreviewEditor from './components/PreviewEditor';
import ProjectList from './components/ProjectList';
import SaveProjectModal from './components/SaveProjectModal';
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Lyrics Video Generator</h1>
            {currentStep !== STEPS.PROJECTS && currentProjectName && (
              <span className="text-gray-400 text-sm">
                — {currentProjectName}
              </span>
            )}
          </div>

          {/* Step Indicator (only show when not on projects page) */}
          {currentStep !== STEPS.PROJECTS && (
            <div className="flex items-center gap-2 text-sm">
              {headerSteps.map((step, i) => (
                <React.Fragment key={step}>
                  <span
                    className={`px-2 py-1 rounded ${
                      currentStep === step
                        ? 'bg-blue-600'
                        : headerSteps.indexOf(currentStep) > i
                        ? 'bg-green-600'
                        : 'bg-gray-700'
                    }`}
                  >
                    {step.charAt(0).toUpperCase() + step.slice(1)}
                  </span>
                  {i < headerSteps.length - 1 && (
                    <span className="text-gray-600">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="text-red-200">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-white"
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
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md text-center p-8">
              <div className="bg-gray-800 rounded-lg p-8">
                <div className="animate-spin w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-6" />
                <h2 className="text-xl font-bold mb-2">Processing Audio...</h2>
                <p className="text-gray-400 mb-6">{processingStatus}</p>
                <button
                  onClick={handleCancelProcessing}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === STEPS.EDIT && (
          <div className="flex-1 flex flex-col">
            {/* Tab Switcher with Project Actions */}
            <div className="bg-gray-800 border-b border-gray-700 px-4">
              <div className="flex items-center justify-between">
                <div className="flex">
                  <button
                    onClick={() => setEditTab(EDIT_TABS.PREVIEW)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      editTab === EDIT_TABS.PREVIEW
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    Preview & Style
                  </button>
                  <button
                    onClick={() => setEditTab(EDIT_TABS.TIMELINE)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      editTab === EDIT_TABS.TIMELINE
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    Timeline Editor
                  </button>
                </div>

                {/* Project Actions */}
                <div className="flex items-center gap-2 py-2">
                  <button
                    onClick={handleBackToProjects}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    My Projects
                  </button>
                  {currentProjectId ? (
                    <>
                      <button
                        onClick={handleQuickSave}
                        className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowSaveModal(true)}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Save As...
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
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
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md text-center p-8">
              <div className="bg-gray-800 rounded-lg p-8">
                <div className="animate-spin w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-6" />
                <h2 className="text-xl font-bold mb-2">Generating Video...</h2>
                <p className="text-gray-400">
                  Rendering your lyrics video. This may take a minute.
                </p>
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
