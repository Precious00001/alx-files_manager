import sha1 from 'sha1'; // Import the sha1 hashing function
import { v4 as uuidv4 } from 'uuid'; // Import the UUID v4 generator
import dbClient from '../utils/db'; // Import the MongoDB client
import redisClient from '../utils/redis'; // Import the Redis client

// Define a class for handling authentication-related controller logic
class AuthController {
  // Static method to handle user authentication
  static async getConnect(request, response) {
    // Extract the user's email and password from the Authorization header
    const authData = request.header('Authorization');
    let userEmail = authData.split(' ')[1];
    const buff = Buffer.from(userEmail, 'base64');
    userEmail = buff.toString('ascii');
    const data = userEmail.split(':');
    
    // Check if email and password are provided
    if (data.length !== 2) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    // Hash the password using SHA1
    const hashedPassword = sha1(data[1]);
    
    // Access the users collection in the database
    const users = dbClient.db.collection('users');
    
    // Find the user by email and hashed password
    users.findOne({ email: data[0], password: hashedPassword }, async (err, user) => {
      if (user) {
        // Generate a unique token using UUID v4
        const token = uuidv4();
        const key = `auth_${token}`;
        // Store the user ID in Redis with the generated token as the key
        await redisClient.set(key, user._id.toString(), 60 * 60 * 24);
        // Respond with the token
        response.status(200).json({ token });
      } else {
        // If user is not found, respond with Unauthorized status
        response.status(401).json({ error: 'Unauthorized' });
      }
    });
  }

  // Static method to handle user logout
  static async getDisconnect(request, response) {
    // Extract the token from the X-Token header
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    // Retrieve the user ID associated with the token from Redis
    const id = await redisClient.get(key);
    if (id) {
      // If user ID is found, delete the token from Redis
      await redisClient.del(key);
      // Respond with No Content status
      response.status(204).json({});
    } else {
      // If token is invalid or expired, respond with Unauthorized status
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
}

// Export the AuthController class for use in other modules
module.exports = AuthController;
