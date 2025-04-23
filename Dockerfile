# Use a more complete Node.js image
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install build essentials
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# First copy only package files to leverage Docker cache
COPY package*.json ./

# Clear npm cache and install dependencies
RUN npm cache clean --force
RUN npm install --build-from-source
RUN npm install bcrypt@5.1.1 --build-from-source

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "dev"] 