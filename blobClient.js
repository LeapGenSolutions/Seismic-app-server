import { BlobServiceClient } from "@azure/storage-blob";
import multer from "multer";

// const multer = require("multer");

// Azure Blob Setup
const storageBlobServiceClient = BlobServiceClient.fromConnectionString(process.env.RECORDINGS_BLOB_CONNECTION_STRING);
export const storageContainerClient = storageBlobServiceClient.getContainerClient(process.env.RECORDINGS_BLOB_CONTAINER);

// Multer config
const storage = multer.memoryStorage();
export const upload = multer({ storage });