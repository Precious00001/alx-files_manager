import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import { promises as fs } from 'fs';
import { ObjectID } from 'mongodb';
import dbClient from './utils/db';

// Creating a new queue instance named 'fileQueue' using redis
const fileQueue =
new Queue('fileQueue', 'redis://127.0.0.1:6379');
// Creating a new queue instance named 'userQueue' using redis
const userQueue =
new Queue('userQueue', 'redis://127.0.0.1:6379');

// Function for generating thumbnail of an image
async function thumbNail(width, localPath) {
  const thumbnail = await imageThumbnail(localPath, { width });
  return thumbnail;
}

// Processing jobs in 'fileQueue' queue
fileQueue.process(async (job, done) => {
  console.log('Processing...');
  // Extracting fileId from job data
  const { fileId } = job.data;
  // Checking if fileId is missing
  if (!fileId) {
    // Returning error if fileId is missing
    done(new Error('Missing fileId'));
  }

  // Extracting userId from job data
  const { userId } = job.data;
  // Checking if userId is missing
  if (!userId) {
    // Returning error if userId is missing
    done(new Error('Missing userId'));
  }

  console.log(fileId, userId);
  // Accessing the files collection
  const files = dbClient.db.collection('files');
  // Creating ObjectID from fileId
  const idObject = new ObjectID(fileId);
  files.findOne({ _id: idObject }, async (err, file) => {
    // Finding file in database
    if (!file) { // If file not found
      console.log('Not found');
      done(new Error('File not found')); // Returning error
    } else { // If file found
      const fileName = file.localPath; // Getting file path
      // Generating thumbnails of different sizes
      const thumbnail500 = await thumbNail(500, fileName);
      const thumbnail250 = await thumbNail(250, fileName);
      const thumbnail100 = await thumbNail(100, fileName);

      console.log('Writing files to system');
      // Constructing file names for thumbnails
      const image500 = `${file.localPath}_500`;
      const image250 = `${file.localPath}_250`;
      const image100 = `${file.localPath}_100`;

      // Writing thumbnails to file system
      await fs.writeFile(image500, thumbnail500);
      await fs.writeFile(image250, thumbnail250);
      await fs.writeFile(image100, thumbnail100);
      done(); // Marking job as done
    }
  });
});

// Processing jobs in 'userQueue' queue
userQueue.process(async (job, done) => {
  // Extracting userId from job data
  const { userId } = job.data;
  // Checking if userId is missing
  if (!userId) done(new Error('Missing userId'));
  // Accessing the users collection
  const users = dbClient.db.collection('users');
  // Creating ObjectID from userId
  const idObject = new ObjectID(userId);
  // Finding user in database
  const user = await users.findOne({ _id: idObject });
  if (user) { // If user found
    console.log(`Welcome ${user.email}!`);
  } else { // If user not found
    done(new Error('User not found'));
  }
});

