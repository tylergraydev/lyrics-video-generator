# Runtime hook to patch importlib.metadata for packages missing metadata
import sys

# Patch importlib.metadata.version to return dummy versions for missing packages
_original_version = None

def _patched_version(package_name):
    try:
        return _original_version(package_name)
    except Exception:
        # Return dummy versions for known packages
        dummy_versions = {
            'imageio': '2.34.0',
            'imageio-ffmpeg': '0.4.9',
            'moviepy': '2.0.0',
            'decorator': '5.1.1',
            'proglog': '0.1.10',
            'tqdm': '4.66.0',
        }
        if package_name.lower() in dummy_versions:
            return dummy_versions[package_name.lower()]
        if package_name.lower().replace('-', '_') in dummy_versions:
            return dummy_versions[package_name.lower().replace('-', '_')]
        raise

try:
    import importlib.metadata
    _original_version = importlib.metadata.version
    importlib.metadata.version = _patched_version
except Exception:
    pass
