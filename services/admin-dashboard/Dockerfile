# Base image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 4001

# Start app
CMD ["npm", "start"]
