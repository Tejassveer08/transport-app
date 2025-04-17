// utils/redis.js - Redis client utility
const redis = require('redis');
const { promisify } = require('util');

// Create Redis client
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('Redis connection refused. Retrying...');
      return Math.min(options.attempt * 100, 3000);
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      console.error('Redis retry time exhausted');
      return new Error('Redis retry time exhausted');
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Handle Redis client errors
client.on('error', (err) => {
  console.error('Redis error:', err);
});

// Log when Redis client connects
client.on('connect', () => {
  console.log('Connected to Redis');
});

// Promisify Redis commands
const get = promisify(client.get).bind(client);
const set = promisify(client.set).bind(client);
const del = promisify(client.del).bind(client);
const incr = promisify(client.incr).bind(client);
const expire = promisify(client.expire).bind(client);
const keys = promisify(client.keys).bind(client);

module.exports = {
  client,
  get,
  set,
  del,
  incr,
  expire,
  keys
};
