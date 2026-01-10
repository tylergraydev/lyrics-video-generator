"""
Projects Module - Persistent Project Storage
============================================
Manages saving and loading lyrics video projects to disk.
"""

import os
import json
import uuid
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional


def get_projects_dir() -> Path:
    """Get the projects storage directory."""
    # Check for environment variable override
    if os.environ.get('LYRICS_VIDEO_PROJECTS_DIR'):
        return Path(os.environ['LYRICS_VIDEO_PROJECTS_DIR'])

    # Default: ~/.lyrics-video-generator/projects
    return Path.home() / '.lyrics-video-generator' / 'projects'


class ProjectManager:
    """Manages persistent project storage."""

    def __init__(self, projects_dir: Optional[Path] = None):
        self.projects_dir = projects_dir or get_projects_dir()
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.projects_dir / 'projects.json'
        self._ensure_index()

    def _ensure_index(self):
        """Create projects index file if it doesn't exist."""
        if not self.index_file.exists():
            self._save_index({'version': 1, 'projects': []})

    def _load_index(self) -> dict:
        """Load the projects index."""
        with open(self.index_file, 'r') as f:
            return json.load(f)

    def _save_index(self, index: dict):
        """Save the projects index."""
        with open(self.index_file, 'w') as f:
            json.dump(index, f, indent=2)

    def _generate_project_id(self) -> str:
        """Generate a unique project ID."""
        return f"proj_{uuid.uuid4().hex[:8]}"

    def _get_project_dir(self, project_id: str) -> Path:
        """Get the directory path for a project."""
        return self.projects_dir / project_id

    def list_projects(self) -> list:
        """
        Return all project summaries, sorted by updated_at (newest first).
        """
        index = self._load_index()
        projects = index.get('projects', [])
        # Sort by updated_at descending
        projects.sort(key=lambda p: p.get('updated_at', ''), reverse=True)
        return projects

    def get_project(self, project_id: str) -> Optional[dict]:
        """
        Load full project data including timing and settings.
        Returns None if project doesn't exist.
        """
        project_dir = self._get_project_dir(project_id)
        metadata_file = project_dir / 'metadata.json'

        if not metadata_file.exists():
            return None

        with open(metadata_file, 'r') as f:
            metadata = json.load(f)

        # Load timing data if exists
        timing_file = project_dir / 'timing.json'
        timing = None
        if timing_file.exists():
            with open(timing_file, 'r') as f:
                timing = json.load(f)

        # Load settings if exists
        settings_file = project_dir / 'settings.json'
        settings = None
        if settings_file.exists():
            with open(settings_file, 'r') as f:
                settings = json.load(f)

        # Load waveform if exists
        waveform_file = project_dir / 'waveform.json'
        waveform = None
        if waveform_file.exists():
            with open(waveform_file, 'r') as f:
                waveform = json.load(f)

        return {
            **metadata,
            'timing': timing,
            'settings': settings,
            'waveform': waveform,
        }

    def create_project(
        self,
        name: str,
        job_dir: Path,
        timing: Optional[dict] = None,
        settings: Optional[dict] = None,
        waveform: Optional[dict] = None,
    ) -> dict:
        """
        Create a new project from files in a job directory.

        Args:
            name: Project display name
            job_dir: Path to temp job directory containing audio, image, lyrics
            timing: Optional timing data dict
            settings: Optional settings dict
            waveform: Optional waveform data dict

        Returns:
            Project metadata dict
        """
        project_id = self._generate_project_id()
        project_dir = self._get_project_dir(project_id)
        project_dir.mkdir(parents=True, exist_ok=True)

        now = datetime.utcnow().isoformat() + 'Z'

        # Find and copy files from job directory
        files = {}

        # Copy audio file
        for f in job_dir.iterdir():
            if f.name.startswith('audio_'):
                ext = f.suffix
                dest = project_dir / f'audio{ext}'
                shutil.copy2(f, dest)
                files['audio'] = dest.name
                break

        # Copy alignment audio if exists
        for f in job_dir.iterdir():
            if f.name.startswith('alignment_audio_'):
                ext = f.suffix
                dest = project_dir / f'alignment_audio{ext}'
                shutil.copy2(f, dest)
                files['alignment_audio'] = dest.name
                break

        # Copy image file
        for f in job_dir.iterdir():
            if f.name.startswith('image_'):
                ext = f.suffix
                dest = project_dir / f'image{ext}'
                shutil.copy2(f, dest)
                files['image'] = dest.name
                break

        # Copy lyrics if exists
        lyrics_file = job_dir / 'lyrics.txt'
        if lyrics_file.exists():
            shutil.copy2(lyrics_file, project_dir / 'lyrics.txt')
            files['lyrics'] = 'lyrics.txt'

        # Get audio duration from timing if available
        audio_duration = timing.get('duration') if timing else None

        # Create metadata
        metadata = {
            'id': project_id,
            'name': name,
            'created_at': now,
            'updated_at': now,
            'status': 'in_progress',
            'files': files,
            'audio_duration': audio_duration,
        }

        # Save metadata
        with open(project_dir / 'metadata.json', 'w') as f:
            json.dump(metadata, f, indent=2)

        # Save timing if provided
        if timing:
            with open(project_dir / 'timing.json', 'w') as f:
                json.dump(timing, f, indent=2)

        # Save settings if provided
        if settings:
            with open(project_dir / 'settings.json', 'w') as f:
                json.dump(settings, f, indent=2)

        # Save waveform if provided
        if waveform:
            with open(project_dir / 'waveform.json', 'w') as f:
                json.dump(waveform, f, indent=2)

        # Update index
        index = self._load_index()
        index['projects'].append({
            'id': project_id,
            'name': name,
            'created_at': now,
            'updated_at': now,
            'status': 'in_progress',
        })
        self._save_index(index)

        return metadata

    def update_project(
        self,
        project_id: str,
        name: Optional[str] = None,
        timing: Optional[dict] = None,
        settings: Optional[dict] = None,
        status: Optional[str] = None,
    ) -> Optional[dict]:
        """
        Update project data.

        Returns updated metadata or None if project doesn't exist.
        """
        project_dir = self._get_project_dir(project_id)
        metadata_file = project_dir / 'metadata.json'

        if not metadata_file.exists():
            return None

        # Load existing metadata
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)

        now = datetime.utcnow().isoformat() + 'Z'
        metadata['updated_at'] = now

        # Update fields if provided
        if name is not None:
            metadata['name'] = name
        if status is not None:
            metadata['status'] = status

        # Save metadata
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        # Save timing if provided
        if timing is not None:
            with open(project_dir / 'timing.json', 'w') as f:
                json.dump(timing, f, indent=2)
            # Update duration from timing
            if 'duration' in timing:
                metadata['audio_duration'] = timing['duration']
                with open(metadata_file, 'w') as f:
                    json.dump(metadata, f, indent=2)

        # Save settings if provided
        if settings is not None:
            with open(project_dir / 'settings.json', 'w') as f:
                json.dump(settings, f, indent=2)

        # Update index
        index = self._load_index()
        for proj in index['projects']:
            if proj['id'] == project_id:
                proj['updated_at'] = now
                if name is not None:
                    proj['name'] = name
                if status is not None:
                    proj['status'] = status
                break
        self._save_index(index)

        return metadata

    def delete_project(self, project_id: str) -> bool:
        """
        Delete a project and all its files.

        Returns True if deleted, False if project didn't exist.
        """
        project_dir = self._get_project_dir(project_id)

        if not project_dir.exists():
            return False

        # Remove project directory
        shutil.rmtree(project_dir)

        # Update index
        index = self._load_index()
        index['projects'] = [p for p in index['projects'] if p['id'] != project_id]
        self._save_index(index)

        return True

    def open_project(self, project_id: str, job_dir: Path) -> Optional[dict]:
        """
        Copy project files to a job directory for editing.

        Args:
            project_id: Project to open
            job_dir: Destination temp job directory

        Returns:
            Dict with timing, settings, waveform or None if project doesn't exist.
        """
        project_dir = self._get_project_dir(project_id)
        metadata_file = project_dir / 'metadata.json'

        if not metadata_file.exists():
            return None

        # Load metadata
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)

        job_dir.mkdir(parents=True, exist_ok=True)

        # Copy files to job directory with expected naming
        files = metadata.get('files', {})

        if 'audio' in files:
            src = project_dir / files['audio']
            if src.exists():
                # Keep original extension but add audio_ prefix
                dest = job_dir / f"audio_{files['audio']}"
                shutil.copy2(src, dest)

        if 'alignment_audio' in files:
            src = project_dir / files['alignment_audio']
            if src.exists():
                dest = job_dir / f"alignment_audio_{files['alignment_audio']}"
                shutil.copy2(src, dest)

        if 'image' in files:
            src = project_dir / files['image']
            if src.exists():
                dest = job_dir / f"image_{files['image']}"
                shutil.copy2(src, dest)

        if 'lyrics' in files:
            src = project_dir / files['lyrics']
            if src.exists():
                shutil.copy2(src, job_dir / 'lyrics.txt')

        # Copy timing.json if exists
        timing_src = project_dir / 'timing.json'
        if timing_src.exists():
            shutil.copy2(timing_src, job_dir / 'timing.json')

        # Copy waveform.json if exists
        waveform_src = project_dir / 'waveform.json'
        if waveform_src.exists():
            shutil.copy2(waveform_src, job_dir / 'waveform.json')

        # Load and return data needed by frontend
        result = {
            'project_id': project_id,
            'name': metadata.get('name'),
        }

        # Load timing
        if timing_src.exists():
            with open(timing_src, 'r') as f:
                result['timing'] = json.load(f)

        # Load settings
        settings_file = project_dir / 'settings.json'
        if settings_file.exists():
            with open(settings_file, 'r') as f:
                result['settings'] = json.load(f)

        # Load waveform
        if waveform_src.exists():
            with open(waveform_src, 'r') as f:
                result['waveform'] = json.load(f)

        # Update last accessed time
        self.update_project(project_id)

        return result

    def get_project_file_path(self, project_id: str, file_type: str) -> Optional[Path]:
        """
        Get the path to a project file.

        Args:
            project_id: Project ID
            file_type: 'audio', 'image', 'alignment_audio', or 'lyrics'

        Returns:
            Path to file or None if not found.
        """
        project_dir = self._get_project_dir(project_id)
        metadata_file = project_dir / 'metadata.json'

        if not metadata_file.exists():
            return None

        with open(metadata_file, 'r') as f:
            metadata = json.load(f)

        files = metadata.get('files', {})
        filename = files.get(file_type)

        if not filename:
            return None

        file_path = project_dir / filename
        return file_path if file_path.exists() else None
