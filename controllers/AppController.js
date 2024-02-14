// Import the Redis client and the MongoDB
// client from their respective utility modules
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

// Define a class for handling application-level controller logic
class AppController {
  // Static method to handle the "/status" route,
  // returning the status of Redis and MongoDB connections
  static getStatus(request, response) {
    // Respond with a JSON object containing the 
    // status of the Redis and MongoDB connections
    response.status(200).json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  }

  // Static method to handle the "/stats" route,
  // returning statistics about users and files
  static async getStats(request, response) {
    // Retrieve the number of users and files
    // asynchronously from the database client
    const usersNum = await dbClient.nbUsers();
    const filesNum = await dbClient.nbFiles();
    // Respond with a JSON object containing the number of users and files
    response.status(200).json({ users: usersNum, files: filesNum });
  }
}

// Export the AppController class for use in other modules
module.exports = AppController;
