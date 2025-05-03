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

// Initialize Azure Blob Storage
const accountKey = atob("MUUvQmt0dXFvbTBZQTlEZDNISHowOVJMVmM2M1ZQZzBNTjV0NFM0ZWptWkFoN1BneFZpNWxvUFFJYmp3NzdOVWZ3cUdTYXNjQ1NYditBU3RFL2ZHaEE9PQ==")
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      "DefaultEndpointsProtocol=https;AccountName=doctorpatientrecordings;AccountKey="+accountKey+";EndpointSuffix=core.windows.net"
    );
const containerClient = blobServiceClient.getContainerClient(
  "doctor-patient-recordings"
);

// Configure multer for in-memory chunk handling
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Endpoint for progressive chunk uploads
app.post(
  "/upload-chunk/:id/:chunkIndex",
  upload.single("chunk"),
  async (req, res) => {
    try {
      const { id, chunkIndex } = req.params;
      const chunk = req.file.buffer;

      const blobName = `${id}/recording_chunk_${Date.now()}_${chunkIndex}.webm`;
      const blobClient = containerClient.getBlockBlobClient(blobName);

      await blobClient.uploadData(chunk, {
        blobHTTPHeaders: { blobContentType: "video/webm" },
      });

      res.status(200).json({
        success: true,
        chunkIndex,
        blobName,
      });
    } catch (error) {
      console.error("Chunk upload failed:", error);
      res.status(500).json({ error: "Chunk upload failed" });
    }
  }
);

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
