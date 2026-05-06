FROM python:3.12-slim

WORKDIR /app

# Copy all planner_service files to /app (this Dockerfile is in planner_service dir as context)
COPY . .

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
