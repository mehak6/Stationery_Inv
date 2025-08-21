# Use the official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Install system dependencies for SQLite
RUN apk add --no-cache \
    sqlite \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy the application code
COPY server.js ./
COPY public/ ./public/

# Create directories for data persistence
RUN mkdir -p /app/data /app/backups /app/logs

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S stationery -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R stationery:nodejs /app

# Switch to non-root user
USER stationery

# Expose the port the app runs on
EXPOSE 3000

# Define environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/stationery_business.db

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🚀 Starting Stationery Business Manager..."' >> /app/start.sh && \
    echo 'echo "📍 Database path: $DB_PATH"' >> /app/start.sh && \
    echo 'echo "🌐 Port: $PORT"' >> /app/start.sh && \
    echo 'node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start the application
CMD ["/app/start.sh"]