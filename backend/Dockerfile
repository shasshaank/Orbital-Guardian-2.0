FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --require-hashes -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY data/ ./data/

# Runtime snapshots/locks are writable without running the API as root.
RUN useradd --uid 10001 --create-home orbital && mkdir -p /app/data/runtime && chown -R orbital:orbital /app/data/runtime
USER orbital

# Expose API port
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
