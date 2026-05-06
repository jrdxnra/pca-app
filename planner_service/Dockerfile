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

# Set environment variables
ENV FITSHIFT_PORT=8080
ENV FITSHIFT_DEBUG=0

# Expose port
EXPOSE 8080

# Run the Flask app
CMD ["python", "-m", "fitshift"]
