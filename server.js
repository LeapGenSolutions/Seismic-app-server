const app = require("express")();
const server = require("http").createServer(app);
const { BlobServiceClient } = require("@azure/storage-blob");
const cors = require("cors");
const multer = require("multer");

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Hello World");
});


const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload/:id", upload.single("file"), async (req, res) => {
  try {
    const id = req.params.id;
    const CHUNK_SIZE = 4 * 1024 * 100;
    const buffer = req.file.buffer;    
    const accountKey = atob("MUUvQmt0dXFvbTBZQTlEZDNISHowOVJMVmM2M1ZQZzBNTjV0NFM0ZWptWkFoN1BneFZpNWxvUFFJYmp3NzdOVWZ3cUdTYXNjQ1NYditBU3RFL2ZHaEE9PQ==")
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      "DefaultEndpointsProtocol=https;AccountName=doctorpatientrecordings;AccountKey="+accountKey+";EndpointSuffix=core.windows.net"
    );

    const containerClient = blobServiceClient.getContainerClient("doctor-patient-recordings");

    let start = 0;
    let index = 0;
    const uploadedChunks = []

    while (start < buffer.length) {
      const end = Math.min(start + CHUNK_SIZE, buffer.length);
      const chunk = buffer.slice(start, end);

      const chunkBlobName = `${id}/${req.file.originalname}_part${index}`;
      const chunkBlobClient = containerClient.getBlockBlobClient(chunkBlobName);

      await chunkBlobClient.uploadData(chunk, {
        blobHTTPHeaders: { blobContentType: req.file.mimetype },
      });

      console.log(`Uploaded chunk: ${chunkBlobName}, size: ${chunk.length}`);
      uploadedChunks.push(chunkBlobName);

      start = end;
      index++;
    }

    res.status(200).json({
      message: "Chunks uploaded as separate blobs",
      chunkCount: index,
      blobs: uploadedChunks,
    });
  } catch (error) {
    console.error("Error uploading chunks as separate blobs:", error);
    res.status(500).json({ error: "Chunk upload failed" });
  }
});


io.on("connection", (socket) => {
  socket.emit("me", socket.id);

  socket.on("disconnect", () => {
    socket.broadcast.emit("callEnded");
  });

  socket.on("callUser", ({ userToCall, signalData, from, name }) => {
    io.to(userToCall).emit("callUser", { signal: signalData, from, name });
  });

  socket.on("answerCall", (data) => {
    io.to(data.to).emit("callAccepted", data.signal);
  });
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
