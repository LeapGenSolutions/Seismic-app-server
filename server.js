const express = require("express");
const http = require("http");
const { config } = require("dotenv");
const cors = require("cors");
const {
  fetchAppointmentsByEmail, fetchAllPatients,
  fetchSOAPByAppointment, fetchBillingByAppointment,
  fetchSummaryByAppointment, fetchTranscriptByAppointment,
  fetchReccomendationByAppointment,
  patchBillingByAppointment,
  fetchClustersByAppointment,
  insertCallHistory,
  fetchEmailFromCallHistory,
  updateCallHistory,
  fetchCallHistoryFromEmail,
  fetchDoctorsFromCallHistory
} = require("./cosmosClient");
const { StreamClient } = require("@stream-io/node-sdk");
const { storageContainerClient, upload } = require("./blobClient");
const { sendMessage } = require("./serviceBusClient");
const { default: axios } = require("axios");

config();

const PORT = process.env.PORT || 8080;

const app = express();
// const allowedOrigin = process.env.CORS_ORIGIN_BASE_URL || "https://victorious-mushroom-08b7e7d0f.4.azurestaticapps.net"; // set this in.env
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

app.get("/api/appointments/:email", async (req, res) => {
  try {
    const { email } = req.params
    const items = await fetchAppointmentsByEmail(email);
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

app.patch("/api/billing/:id", async (req, res) => {
  try {
    const { id } = req.params
    await patchBillingByAppointment(id, req.query.username, req.body.billing_codes)
    res.status(200).json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to send message to queue" })
  }
});

app.get("/api/clusters/:id", async (req, res) => {
  const { id } = req.params;
  const partitionKey = req.query.username;

  if (!partitionKey) {
    return res.status(400).json({ error: "partitionKey query param is required" });
  }

  try {
    const item = await fetchClustersByAppointment(id, partitionKey);
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

app.get("/api/recommendations/:id", async (req, res) => {
  const { id } = req.params;
  const partitionKey = req.query.userID;

  if (!partitionKey) {
    return res.status(400).json({ error: "partitionKey query param is required" });
  }

  try {
    const item = await fetchReccomendationByAppointment(id, partitionKey);
    res.json(item);
  } catch (err) {
    console.error("Error fetching item:", err);
    res.status(404).json({ error: "Item not found" });
  }
});

app.post("/get-token", async (req, res) => {

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

});

app.get("/api/doctors/call-history", async (req, res) => {
  try {
    const item = await fetchDoctorsFromCallHistory();
    res.json(item);
  } catch (err) {
    console.error("Error fetching item:", err);
    res.status(404).json({ error: "Item not found" });
  }
})

app.get("/api/call-history/:userID", async (req, res) => {
  const { userID } = req.params
  try {
    const item = await fetchCallHistoryFromEmail(userID);
    res.json(item);
  } catch (err) {
    console.error("Error fetching item:", err);
    res.status(404).json({ error: "Item not found" });
  }
})

app.post("/api/call-history/:id", async (req, res) => {
  const { id } = req.params
  const reqBody = req.body
  let errorMsg = ""
  try {
    if (!reqBody.userID) {
      errorMsg = "UserID is mandatory"
    }
    await insertCallHistory(id, reqBody)
    res.status(200).json({ success: true })
  } catch (error) {
    res.status(500).json({ error: errorMsg || "Failed to Insert into DB" })
  }

})

app.post("/webhook", async (req, res) => {
  const { type } = req.body;
  if (type === 'call.recording_ready') {
    console.log(req.body);
    const { call_cid } = req.body
    const { url: videoUrl, filename } = req.body.call_recording;

    try {
      const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      const client = new StreamClient(process.env.STREAM_IO_APIKEY, process.env.STREAM_IO_SECRET);
      const apptID = call_cid.split(":")[1]
      const call = await client.video.getCall({
        id: apptID,
        type: "default"
      })
      const username = await fetchEmailFromCallHistory(apptID)
      const meetingChunks = filename.split("_")
      const meetingChunkName = meetingChunks[meetingChunks.length - 1]
      const blobName = `${username}/${apptID}/meeting_part${meetingChunkName}`;
      console.log(call.call.created_by.name);
      const blobClient = storageContainerClient.getBlockBlobClient(blobName);
      await blobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: 'video/mp4'
        }
      });
      console.log(`✅ Saved recording for ${call_cid}`);
      return res.status(200).json({ "success": "Uploaded the blob sucessfulyy" });
    } catch (error) {
      return res.status(500).json({ "message": "Uploaded the blob failed" });

    }
  }
  if (type === "call.session_ended") {
    console.log(`Call Session ended`);
    console.log(req.body);
    const { call_cid, session_id, created_at } = req.body
    const client = new StreamClient(process.env.STREAM_IO_APIKEY, process.env.STREAM_IO_SECRET);
    const apptID = call_cid.split(":")[1]
    const call = await client.video.getCall({
      id: apptID,
      type: "default"
    })
    updateCallHistory(session_id, {
      endTime: created_at,
    })

    if (call.members.length == 0) {
      client.video.endCall({
        id: apptID,
        type: "default"
      })
    }
    return res.status(200).json({ "success": "Call Session ended" });
  }
  if (type === "call.session_participant_left") {
    console.log(`Call Session participant left`);
    console.log(req.body);
    return res.status(200).json({ "success": "Call session participant left" });
  }
  if (type === "call.ended") {
    console.log(`Call Ended`);
    console.log(req.body);
    return res.status(200).json({ "success": "Call ended" });
  }

  // res.sendStatus(204); // ignored
});

httpServer.listen(PORT, () =>
  console.log(`server is running on port: ${PORT}`)
);
