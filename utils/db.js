import { MongoClient } from 'mongodb';

// Default configuration values for MongoDB connection
const HOST = process.env.DB_HOST || 'localhost';
const PORT = process.env.DB_PORT || 27017;
const DATABASE = process.env.DB_DATABASE || 'files_manager';

// MongoDB connection URL based on the configuration values
const url = `mongodb://${HOST}:${PORT}`;

// Class representing a MongoDB client
class DBClient {
  constructor() {
    // Create a new MongoClient instance with provided URL and options
    this.client = new MongoClient(url, { useUnifiedTopology: true, useNewUrlParser: true });

    // Establish connection to MongoDB server and initialize database
    this.client.connect().then(() => {
      // Set 'db' property to the database instance
      this.db = this.client.db(`${DATABASE}`);
    }).catch((err) => {
      // Log any connection errors
      console.log(err);
    });
  }

  // Method to check if the MongoDB client is connected to the server
  isAlive() {
    return this.client.isConnected();
  }

  // Method to asynchronously retrieve the number of users in the database
  async nbUsers() {
    // Access the 'users' collection
    const users = this.db.collection('users');
    
    // Retrieve the count of documents in the 'users' collection
    const usersNum = await users.countDocuments();
    
    // Return the number of users
    return usersNum;
  }

  // Method to asynchronously retrieve the number of files in the database
  async nbFiles() {
    // Access the 'files' collection
    const files = this.db.collection('files');
    
    // Retrieve the count of documents in the 'files' collection
    const filesNum = await files.countDocuments();
    
    // Return the number of files
    return filesNum;
  }
}

// Create an instance of the DBClient class
const dbClient = new DBClient();

// Export the DBClient instance for use in other modules
module.exports = dbClient;
