const { Kafka } = require('kafkajs');

// Create Kafka client
const kafka = new Kafka({
  clientId: 'logistics-revolution',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  ssl: process.env.KAFKA_SSL === 'true',
  sasl: process.env.KAFKA_SASL_USERNAME ? {
    mechanism: 'plain',
    username: process.env.KAFKA_SASL_USERNAME,
    password: process.env.KAFKA_SASL_PASSWORD
  } : null,
  retry: {
    initialRetryTime: 100,
    retries: 5
  }
});

// Create producer
const producer = kafka.producer();

// Connect to Kafka
let connected = false;
async function connectProducer() {
  if (!connected) {
    try {
      await producer.connect();
      connected = true;
      console.log('Connected to Kafka');
    } catch (error) {
      console.error('Failed to connect to Kafka:', error);
      setTimeout(connectProducer, 5000);
    }
  }
}

// Connect immediately
connectProducer();

/**
 * Publish message to Kafka topic
 * @param {String} topic - Kafka topic
 * @param {Object} message - Message to publish
 * @returns {Promise} Promise resolving on publish
 */
exports.publishToKafka = async (topic, message) => {
  try {
    if (!connected) {
      await connectProducer();
    }
    
    await producer.send({
      topic,
      messages: [
        { 
          value: JSON.stringify(message),
          timestamp: Date.now().toString()
        }
      ]
    });
    
    return true;
  } catch (error) {
    console.error(`Error publishing to Kafka topic ${topic}:`, error);
    throw error;
  }
};
