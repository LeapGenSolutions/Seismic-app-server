const express = require("express");
const http = require("http");
const { config } = require("dotenv");
const cors = require("cors");
const { fetchAllAppointments, fetchAllPatients,
  fetchSOAPByAppointment, fetchBillingByAppointment,
  fetchSummaryByAppointment, fetchTranscriptByAppointment } = require("./cosmosClient");
const { StreamClient } = require("@stream-io/node-sdk");
const { storageContainerClient, upload } = require("./blobClient");
const { sendMessage } = require("./serviceBusClient");

config();

const PORT = process.env.PORT || 8080;

const app = express();
// const allowedOrigin = process.env.CORS_ORIGIN_BASE_URL || "https://victorious-mushroom-08b7e7d0f.4.azurestaticapps.net"; // set this in .env
const allowedOrigin = "*"; // set this in .env
app.use(express.json());
app.use(cors({
  origin: allowedOrigin,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const httpServer = http.createServer(app);

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.get("/api/appointments", async (req, res) => {
  try {
    const items = await fetchAllAppointments();
    res.json(items);
  } catch (err) {
    // console.error("Error fetching items:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/patients", async (req, res) => {
  try {
    const items = await fetchAllPatients();
    res.json(items);
  } catch (err) {
    // console.error("Error fetching items:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/soap/:id", async (req, res) => {
  const { id } = req.params;
  const partitionKey = req.query.userID;

  if (!partitionKey) {
    return res.status(400).json({ error: "partitionKey query param is required" });
  }

  try {
    const item = await fetchSOAPByAppointment(id, partitionKey);
    res.json(item);
  } catch (err) {
    console.error("Error fetching item:", err);
    res.status(404).json({ error: "Item not found" });
  }
});

app.get("/api/billing/:id", async (req, res) => {
  const { id } = req.params;
  const partitionKey = req.query.userID;

  if (!partitionKey) {
    return res.status(400).json({ error: "partitionKey query param is required" });
  }

  try {
    const item = await fetchBillingByAppointment(id, partitionKey);
    res.json(item);
  } catch (err) {
    console.error("Error fetching item:", err);
    res.status(404).json({ error: "Item not found" });
  }
});

app.get("/api/summary/:id", async (req, res) => {
  const { id } = req.params;
  const partitionKey = req.query.userID;

  if (!partitionKey) {
    return res.status(400).json({ error: "partitionKey query param is required" });
  }

  try {
    const item = await fetchSummaryByAppointment(id, partitionKey);
    res.json(item);
  } catch (err) {
    console.error("Error fetching item:", err);
    res.status(404).json({ error: "Item not found" });
  }
});

app.get("/api/transcript/:id", async (req, res) => {
  const { id } = req.params;
  const partitionKey = req.query.userID;

  if (!partitionKey) {
    return res.status(400).json({ error: "partitionKey query param is required" });
  }

  try {
    const item = await fetchTranscriptByAppointment(id, partitionKey);
    res.json(item);
  } catch (err) {
    console.error("Error fetching item:", err);
    res.status(404).json({ error: "Item not found" });
  }
});

app.post("/get-token", (req, res) => {
  console.log(req.body);

  const { userId } = req.body;
  const client = new StreamClient(process.env.STREAM_IO_APIKEY, process.env.STREAM_IO_SECRET);

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const validity = 3600; // 1 hour
    const token = client.generateUserToken({ user_id: userId, validity_in_seconds: validity });
    return res.json({ token });
  } catch (error) {
    console.log("Error generating token", error);
    return res.status(500).json({ error: "Failed to generate token" });
  }
});

app.post("/upload-chunk/:id/:chunkIndex",
  upload.single("chunk"),
  async (req, res) => {
    try {
      const { id, chunkIndex } = req.params;
      const chunk = req.file.buffer;


      const blobName = `${req.query.username}/${id}/meeting_part${chunkIndex}.webm`;
      const blobClient = storageContainerClient.getBlockBlobClient(blobName);

      await blobClient.uploadData(chunk, {
        blobHTTPHeaders: { blobContentType: "video/webm" },
      });

      res.status(200).json({ success: true, chunkIndex, blobName });
    } catch (error) {
      console.error("Chunk upload failed:", error);
      res.status(500).json({ error: "Chunk upload failed" });
    }
  }
);

app.post("/api/end-call/:appointmentId", async (req, res) => {
  try {
    const { appointmentId } = req.params
    
    await sendMessage(req.query.username, appointmentId)
    res.status(200).json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to send message to queue" })
  }

})

httpServer.listen(PORT, () =>
  console.log(`server is running on port: ${PORT}`)
);
