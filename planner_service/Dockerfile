FROM python:3.12-slim

WORKDIR /app

# Copy only the necessary files from planner_service (not node_modules or instance dir)
# setuptools gets confused if multiple packages are discovered
COPY planner_service/fitshift ./fitshift/
COPY planner_service/pyproject.toml ./
COPY planner_service/README.md ./

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir 'Flask>=3.0,<4.0' && \
    pip install --no-cache-dir -e .

# Cloud Run will set PORT env var (default 8080)
ENV PORT=8080

# Expose the port
EXPOSE $PORT

# Run the Flask app (will read PORT env var)
CMD ["python", "-m", "fitshift"]
