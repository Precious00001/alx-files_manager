import { createClient } from 'redis';
import { promisify } from 'util';

// Class to define methods for commonly used Redis commands
class RedisClient {
  constructor() {
    // Initialize Redis client
    this.client = createClient();
    
    // Event handler for Redis client errors
    this.client.on('error', (error) => {
      console.log(`Redis client not connected to server: ${error}`);
    });
  }

  // Method to check if the Redis client
  // is alive (connected to the server)
  isAlive() {
    if (this.client.connected) {
      return true;
    }
    return false;
  }

  // Method to retrieve the value for a given key from the Redis server
  async get(key) {
    // Promisify Redis GET method
    const redisGet = promisify(this.client.get).bind(this.client);
    
    // Retrieve value for the specified key
    const value = await redisGet(key);
    
    return value;
  }

  // Method to set a key-value pair in the Redis
  // server with an optional expiration time
  async set(key, value, time) {
    // Promisify Redis SET method
    const redisSet = promisify(this.client.set).bind(this.client);
    
    // Set key-value pair
    await redisSet(key, value);
    
    // Set expiration time for the key if provided
    if (time) {
      await this.client.expire(key, time);
    }
  }

  // Method to delete a key-value pair from the Redis server
  async del(key) {
    // Promisify Redis DEL method
    const redisDel = promisify(this.client.del).bind(this.client);
    
    // Delete key-value pair
    await redisDel(key);
  }
}

// Create an instance of the RedisClient class
const redisClient = new RedisClient();

// Export the RedisClient instance
module.exports = redisClient;
