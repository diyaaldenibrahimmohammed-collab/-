FROM node:20-slim

# =============================================
# استخدام Chromium من مستودع Debian الرسمي
# هذا الحل أكثر استقراراً ويتجنب مشاكل GPG Keys
# =============================================
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package-render.json ./package.json

# Install global dependencies first
RUN npm install --only=production --no-audit --no-fund

# Copy app code
COPY index-optimized.js ./
COPY subscriptions.js ./
COPY database.js ./

# Environment Variables for Puppeteer
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 10000

# Run with garbage collection optimization
CMD ["node", "--expose-gc", "--max-old-space-size=460", "index-optimized.js"]
