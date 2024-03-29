# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the entire project to the working directory
COPY src/ ./src/
COPY package*.json .
COPY index.html .
COPY tsconfig.json .
COPY vite.config.ts .
COPY .eslintrc.json .

# Install the dependencies
RUN npm install

# Expose the port that the app will run on
EXPOSE 3000

# Define the command to run the app
CMD ["npm", "start"]
