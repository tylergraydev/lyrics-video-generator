# Lyrics Video Generator - Docker Configuration
# 
# Build: docker build -t lyrics-video-generator .
# Run:   docker run -p 5000:5000 -v $(pwd)/output:/app/output lyrics-video-generator

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    fonts-dejavu-core \
    fonts-liberation \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Download Whisper model (base) during build to speed up first run
RUN python -c "import whisperx; whisperx.load_model('base', 'cpu', compute_type='float32')" || true

# Copy application code
COPY backend/*.py ./

# Create directories
RUN mkdir -p /app/output /app/uploads

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=api_server.py

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Run the API server
CMD ["python", "api_server.py"]
