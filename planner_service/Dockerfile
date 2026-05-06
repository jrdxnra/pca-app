FROM python:3.12-slim

WORKDIR /app

# Copy planner_service files into /app
# (this Dockerfile is located in planner_service/ but we're building from repo root)
COPY planner_service/ .

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
