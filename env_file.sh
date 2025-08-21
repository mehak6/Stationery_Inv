# Environment Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
# For local development, use your local PostgreSQL URL
# DATABASE_URL=postgresql://username:password@localhost:5432/stationery_business

# For Render deployment, this will be automatically set by Render
# DATABASE_URL will be provided by Render PostgreSQL service

# Security
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# CORS Origins (comma separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# App Configuration
APP_NAME=Stationery Business Manager
APP_VERSION=2.0.0