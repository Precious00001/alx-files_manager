// Import the Express framework
import express from 'express';

// Import the router module containing route definitions
import router from './routes/index';

// Parse the port from the environment variables
// or use a default port (5000)
const port = parseInt(process.env.PORT, 10) || 5000;

// Create an instance of the Express application
const app = express();

// Middleware to parse incoming JSON requests
app.use(express.json());

// Mount the router middleware at the root path
app.use('/', router);

// Start the Express server and listen on the specified port
app.listen(port, () => {
  // Log a message indicating that the server is
  // running and listening on the specified port
  console.log(`server running on port ${port}`);
});

// Export the Express application for use in other modules
export default app;
