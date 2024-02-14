import sha1 from 'sha1';
import { ObjectID } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

// Creating a new queue instance named 'userQueue' using redis
const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');

// Class definition for UsersController
class UsersController {
  // Method for handling POST request to create a new user
  static postNew(request, response) {
    // Extracting email from request body
    const { email } = request.body;
    // Extracting password from request body
    const { password } = request.body;

    // Checking if email is missing
    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }

    // Checking if password is missing
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }

    // Accessing the users collection
    const users = dbClient.db.collection('users'); 
    // Checking if the user with the given email already exists
    users.findOne({ email }, (err, user) => {
      if (user) { // If user exists, return error
        response.status(400).json({ error: 'Already exist' });
      } else {
        // If user doesn't exist, hash the password and insert user into database
        const hashedPassword = sha1(password); // Hashing the password using sha1
        users.insertOne(
          {
            email,
            password: hashedPassword,
          },
        ).then((result) => { // Handling insertion success
          // Sending response with user id and email
          response.status(201).json({ id: result.insertedId, email });
          // Adding user id to the queue for further processing
          userQueue.add({ userId: result.insertedId });
        }).catch((error) => console.log(error)); // Handling insertion failure
      }
    });
  }

  // Method for handling GET request to fetch user details
  static async getMe(request, response) {
    // Extracting token from request headers
    const token = request.header('X-Token');
    // Constructing the key for accessing user id in Redis
    const key = `auth_${token}`;
    // Getting user id from Redis cache
    const userId = await redisClient.get(key);

    // If user id exists in cache, fetch user details from database
    if (userId) {
      // Accessing the users collection
      const users = dbClient.db.collection('users');
      // Creating ObjectID from user id 
      const idObject = new ObjectID(userId);
      // Finding user in database using user id
      users.findOne({ _id: idObject }, (err, user) => {
        if (user) { // If user exists, send user details in response
          response.status(200).json({ id: userId, email: user.email });
        } else { // If user doesn't exist, send unauthorized error
          response.status(401).json({ error: 'Unauthorized' });
        }
      });
    } else { // If user id doesn't exist in cache, send unauthorized error
      console.log('Hupatikani!');
      response.status(401).json({ error: 'Unauthorized' });
    }
  }
}

module.exports = UsersController; // Exporting UsersController class

