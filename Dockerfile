FROM node:20-slim

# =============================================
# تثبيت Chrome عبر المستودع الرسمي من Google
# أكثر موثوقية من تنزيل .deb مباشرة
# =============================================
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    --no-install-recommends \
    && wget -q -O /usr/share/keyrings/google-chrome.gpg \
       https://dl.google.com/linux/linux_signing_key.pub \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] \
       https://dl.google.com/linux/chrome/deb/ stable main" \
       > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package-render.json ./package.json

# Install Node dependencies
RUN npm install --only=production --no-audit --no-fund

# Copy app code
COPY index-optimized.js ./
COPY subscriptions.js* ./
COPY database.js* ./

# Environment
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

EXPOSE 10000

CMD ["node", "--expose-gc", "--max-old-space-size=460", "index-optimized.js"]
