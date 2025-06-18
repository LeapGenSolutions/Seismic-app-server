const express = require("express");
const http = require("http");
const { config } = require("dotenv");
const cors = require("cors");
const {  
  insertCallHistory,
  fetchEmailFromCallHistory,
  updateCallHistory
} = require("./cosmosClient");
const { StreamClient } = require("@stream-io/node-sdk");
const { storageContainerClient, upload } = require("./blobClient");
const { sendMessage } = require("./serviceBusClient");
const { default: axios } = require("axios");
const appointmentsRouter = require("./routes/appointments");
const patientsRouter = require("./routes/patients");
const soapRouter = require("./routes/soap");
const billingRouter = require("./routes/billing");
const summaryRouter = require("./routes/summary");
const summaryOfSummaryRouter = require("./routes/summaryOfSummary");
const transcriptRouter = require("./routes/transcript");
const recommendationRouter = require("./routes/recommendation");
const clustersRouter = require("./routes/clusters");
const callHistoryRouter = require("./routes/callHistory");

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

app.use("/api/appointments", appointmentsRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/soap-notes", soapRouter);
app.use("/api/billing", billingRouter);
app.use("/api/summary-of-summary", summaryOfSummaryRouter);
app.use("/api/summary", summaryRouter);
app.use("/api/transcript", transcriptRouter);
app.use("/api/recommendations", recommendationRouter);
app.use("/api/clusters", clustersRouter);
app.use("/api/call-history", callHistoryRouter);

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
