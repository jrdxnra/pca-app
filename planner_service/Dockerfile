FROM python:3.12-slim

WORKDIR /app/planner_service

# Copy planner_service contents (we're in /app/planner_service context in build)
COPY planner_service/ .

# Install Flask and then the local fitshift package in editable mode
RUN pip install --no-cache-dir 'Flask>=3.0,<4.0' && \
    pip install --no-cache-dir -e .

# Set environment variables
ENV FITSHIFT_PORT=8080
ENV FITSHIFT_DEBUG=0

# Expose port
EXPOSE 8080

# Run the Flask app
CMD ["python", "-m", "fitshift"]
