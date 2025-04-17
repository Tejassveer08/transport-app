const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const morgan = require('morgan');
const routes = require('./routes');
const { initiateEventListener } = require('./services/eventService');
const { initializeKafkaConsumer } = require('./services/kafkaConsumer');

// Load environment variables
require('dotenv').config();

// Create Express application
const app = express();
const server = http.createServer(app);

// Set up WebSocket server
const wss = new WebSocket.Server({ server });

// Middleware
app.use(helmet()); // Security headers
app.use(cors());   // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(morgan('combined')); // Request logging

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB:', err));

// API Routes
app.use('/api', routes);

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Send initial data to client
  ws.send(JSON.stringify({
    type: 'WELCOME',
    message: 'Connected to Logistics Revolution WebSocket Server'
  }));
  
  // Handle client messages
  ws.on('message', (message) => {
    console.log('Received message:', message);
    
    try {
      const data = JSON.parse(message);
      // Handle different message types
      if (data.type === 'SUBSCRIBE') {
        // Add client to subscription list for specific updates
      } else if (data.type === 'COMMAND') {
        // Process command
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Initialize Kafka consumer for real-time events
initializeKafkaConsumer()
  .then(() => console.log('Kafka consumer initialized'))
  .catch(err => console.error('Failed to initialize Kafka consumer:', err));

// Start event listener for various system events
initiateEventListener();

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

