import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { ObjectID } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

// Creating a new queue instance named 'fileQueue' using redis
const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

// Class definition for FilesController
class FilesController {
  // Method for fetching user details based on token
  static async getUser(request) {
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
      const user = await users.findOne({ _id: idObject });
      if (!user) { // If user doesn't exist in database, return null
        return null;
      }
      return user; // Return user object
    }
    return null; // If user id doesn't exist in cache, return null
  }

  // Method for handling POST request to upload a file
  static async postUpload(request, response) {
    // Fetching user details based on token
    const user = await FilesController.getUser(request);
    if (!user) { // If user doesn't exist, return unauthorized error
      return response.status(401).json({ error: 'Unauthorized' });
    }
    // Extracting file name from request body
    const { name } = request.body;
    // Extracting file type from request body
    const { type } = request.body;
    // Extracting parent id from request body
    const { parentId } = request.body;
    // Setting isPublic to false if not provided
    const isPublic = request.body.isPublic || false;
    // Extracting file data from request body
    const { data } = request.body;

    // Validating required fields
    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }
    if (!type) {
      return response.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Missing data' });
    }

    const files = dbClient.db.collection('files'); // Accessing the files collection
    // Checking if parentId exists and if it's a valid folder
    if (parentId) {
      // Creating ObjectID from parent id
      const idObject = new ObjectID(parentId);
      // Finding parent file in database
      const file = await files.findOne({ _id: idObject, userId: user._id }); 
      if (!file) { // If parent file doesn't exist, return error
        return response.status(400).json({ error: 'Parent not found' });
      }
      if (file.type !== 'folder') {
        // If parent file is not a folder, return error
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // Handling file upload
    if (type === 'folder') { // If file type is folder
      // Inserting folder details into database
      files.insertOne(
        {
          userId: user._id,
          name,
          type,
          parentId: parentId || 0,
          isPublic,
        },
      ).then((result) => response.status(201).json({
        // Sending response with folder details
        id: result.insertedId,
        userId: user._id,
        name,
        type,
        isPublic,
        parentId: parentId || 0,
      })).catch((error) => {
        console.log(error);
      });
      // If file type is not folder
    } else {
      // Setting file path
      const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';
      // Generating unique file name using UUID
      const fileName = `${filePath}/${uuidv4()}`;
      // Converting base64 data to buffer
      const buff = Buffer.from(data, 'base64');

      try { // Handling file write operation
        try {
          await fs.mkdir(filePath); // Creating directory if not exists
        } catch (error) {
          // pass. Error raised when file already exists
        }
        await fs.writeFile(fileName, buff, 'utf-8'); // Writing file to disk
      } catch (error) {
        console.log(error);
      }

      // Inserting file details into database
      files.insertOne(
        {
          userId: user._id,
          name,
          type,
          isPublic,
          parentId: parentId || 0,
          localPath: fileName,
        },
      ).then((result) => {
        response.status(201).json( // Sending response with file details
          {
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic,
            parentId: parentId || 0,
          },
        );
        if (type === 'image') {
          // If file type is image, add file to processing queue
          fileQueue.add(
            {
              userId: user._id,
              fileId: result.insertedId,
            },
          );
        }
      }).catch((error) => console.log(error));
    }
    return null;
  }

  // Method for fetching details of a specific file
  static async getShow(request, response) {
    // Fetching user details based on token
    const user = await FilesController.getUser(request);
    if (!user) { // If user doesn't exist, return unauthorized error
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const fileId = request.params.id; // Extracting file id from request parameters
    const files = dbClient.db.collection('files'); // Accessing the files collection
    const idObject = new ObjectID(fileId); // Creating ObjectID from file id
    // Finding file in database
    const file = await files.findOne({ _id: idObject, userId: user._id });
    if (!file) { // If file doesn't exist, return not found error
      return response.status(404).json({ error: 'Not found' });
    }
    return response.status(200).json(file); // Sending response with file details
  }

  // Method for fetching a list of files
  static async getIndex(request, response) {
    // Fetching user details based on token
    const user = await FilesController.getUser(request);
    if (!user) { // If user doesn't exist, return unauthorized error
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const {
      parentId,
      page,
    } = request.query; // Extracting parent id and page number from request query
    const pageNum = page || 0; // Setting default page number to 0
    const files = dbClient.db.collection('files'); // Accessing the files collection
    let query;
    if (!parentId) { // Constructing query based on parent id
      query = { userId: user._id };
    } else {
      query = { userId: user._id, parentId: ObjectID(parentId) };
    }
    // Fetching files based on query and pagination
    files.aggregate(
      [
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields:
              { page: parseInt(pageNum, 10) } }],
            data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
          },
        },
      ],
    ).toArray((err, result) => {
      if (result) { // If result exists, format data and send response
        const final = result[0].data.map((file) => {
          const tmpFile = {
            ...file,
            id: file._id,
          };
          delete tmpFile._id;
          delete tmpFile.localPath;
          return tmpFile;
        });
        // Sending response with formatted data
        return response.status(200).json(final); 
      }
      console.log('Error occured');
      // If no result found, return not found error
      return response.status(404).json({ error: 'Not found' });
    });
    return null;
  }

  // Method for publishing a file
  static async putPublish(request, response) {
    // Fetching user details based on token
    const user = await FilesController.getUser(request);
    if (!user) { // If user doesn't exist, return unauthorized error
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params; // Extracting file id from request parameters
    const files = dbClient.db.collection('files'); // Accessing the files collection
    const idObject = new ObjectID(id); // Creating ObjectID from file id
    const newValue = { $set: { isPublic: true } }; // Setting file to public
    const options = { returnOriginal: false }; // Setting options for update operation
    // Finding and updating file in database
    files.findOneAndUpdate({ _id: idObject, userId: user._id },
      newValue, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        // If file not updated, return not found error
        return response.status(404).json({ error: 'Not found' });
      }
      // Sending response with updated file details
      return response.status(200).json(file.value);
    });
    return null;
  }

  // Method for unpublishing a file
  static async putUnpublish(request, response) {
    // Fetching user details based on token
    const user = await FilesController.getUser(request);
    if (!user) { // If user doesn't exist, return unauthorized error
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params; // Extracting file id from request parameters
    const files = dbClient.db.collection('files'); // Accessing the files collection
    const idObject = new ObjectID(id); // Creating ObjectID from file id
    const newValue = { $set: { isPublic: false } }; // Setting file to private
    const options = { returnOriginal: false }; // Setting options for update operation
    // Finding and updating file in database
    files.findOneAndUpdate({ _id: idObject, userId: user._id },
      newValue, options, (err, file) => {
        // If file not updated, return not found error
      if (!file.lastErrorObject.updatedExisting) {
        return response.status(404).json({ error: 'Not found' });
      }
      // Sending response with updated file details
      return response.status(200).json(file.value);
    });
    return null;
  }

  // Method for fetching a file
  static async getFile(request, response) {
    const { id } = request.params; // Extracting file id from request parameters
    const files = dbClient.db.collection('files'); // Accessing the files collection
    const idObject = new ObjectID(id); // Creating ObjectID from file id
    files.findOne({ _id: idObject }, async (err, file) => {
      if (!file) { // If file doesn't exist, return not found error
        return response.status(404).json({ error: 'Not found' });
      }
      console.log(file.localPath);
      if (file.isPublic) { // If file is public
        if (file.type === 'folder') { // If file is folder, return error
          return response.status(400)
          .json({ error: "A folder doesn't have content" });
        }
        try { // Handling file read operation
          let fileName = file.localPath; // Setting file name
          // Extracting file size from request parameters
          const size = request.param('size'); 
          if (size) { // If size provided, modify file name
            fileName = `${file.localPath}_${size}`;
          }
          // Reading file from disk
          const data = await fs.readFile(fileName);
          // Determining file content type
          const contentType = mime.contentType(file.name);
          // Sending file as response
          return response.header('Content-Type', contentType)
          .status(200).send(data);
        } catch (error) { // Handling error if file not found
          console.log(error);
          return response.status(404).json({ error: 'Not found' });
        }
      } else { // If file is private
        const user = await FilesController.getUser(request);
        if (!user) { // If user doesn't exist, return unauthorized error
          return response.status(404).json({ error: 'Not found' });
        }
        // If file belongs to the user
        if (file.userId.toString() === user._id.toString()) {
          if (file.type === 'folder') { // If file is folder, return error
            return response.status(400)
            .json({ error: "A folder doesn't have content" });
          }
          try { // Handling file read operation
            let fileName = file.localPath; // Setting file name
            // Extracting file size from request parameters
            const size = request.param('size');
            if (size) { // If size provided, modify file name
              fileName = `${file.localPath}_${size}`;
            }
            // Determining file content type
            const contentType = mime.contentType(file.name);
            return response.header('Content-Type', contentType)
            .status(200).sendFile(fileName); // Sending file as response
          } catch (error) { // Handling error if file not found
            console.log(error);
            // Returning not found error
            return response.status(404).json({ error: 'Not found' });
          }
        } else { // If file doesn't belong to the user
          console.log(`Wrong user: file.userId=${file.userId}; userId=${user._id}`);
          // Returning not found error
          return response.status(404).json({ error: 'Not found' });
        }
      }
    });
  }
}
// Exporting FilesController class
module.exports = FilesController;

