const express = require("express");
const http = require("http");
const { config } = require("dotenv");
const cors = require("cors");
const { fetchAllAppointments, fetchAllPatients,
  fetchSOAPByAppointment, fetchBillingByAppointment,
  fetchSummaryByAppointment, fetchTranscriptByAppointment,
  fetchReccomendationByAppointment,
  patchBillingByAppointment } = require("./cosmosClient");
const { StreamClient, StreamVideoClient } = require("@stream-io/node-sdk");
const { storageContainerClient, upload } = require("./blobClient");
const { sendMessage } = require("./serviceBusClient");
const { default: axios } = require("axios");

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

app.patch("/api/billing/:id", async (req, res) => {
  try {
    const { id } = req.params
    await patchBillingByAppointment(id, req.query.username, req.body.billing_codes)
    res.status(200).json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Failed to send message to queue" })
  }
})

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
  console.log(req.body);

  const { userId } = req.body;
  const client = new StreamClient(process.env.STREAM_IO_APIKEY, process.env.STREAM_IO_SECRET);

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  // const recData = `{
  //     type: 'call.recording_ready',
  //       created_at: '2025-06-06T21:23:00.427846676Z',
  //         call_cid: 'default:2025-06-06_1015',
  //           call_recording: {
  //       filename: 'rec_default_2025-06-06_1015_720p_1749244938038.mp4',
  //         url: 'https://us-east.stream-io-cdn.com/1388924/video/recordings/default_2025-06-06_1015/rec_default_2025-06-06_1015_720p_1749244938038.mp4?Expires=1750454580&Signature=e2JtlLOq0NhClHKvY8QeVoHEhF3yrCQjQnlkp9jrEVN-mK81xcUbupNkS8XFYeVgpOheJRiOvObO4uUcrwkDTeOph3HOI334lR1KDoEvuxIBfvNXI0-bz4CHy1DH7FPeKqpvVvIsjMjyNeiKKm5yfCk1y~NSFW229MUWaBJqUy~Vqp45LGFno2f9~SBIKJOshrk6wkzrZ1OfCwJSXSWDmmu8ERe~j5zVnTw6KRet3wFMyB7ajDWEs2Xr5OEa7ETf-V3OMFSesA9ek5KGzh0t76sF8mg9UErRg0RnrbRhOm6Vkyl-OznSd7fjvOCNj3bwK6b2fQ1GB1mzOTyqfAjCdw__&Key-Pair-Id=APKAIHG36VEWPDULE23Q',
  //           start_time: '2025-06-06T21:22:22.891526071Z',
  //             end_time: '2025-06-06T21:22:53.691208901Z',
  //               session_id: '6680d971-2036-4627-9baa-84684a536f34'
  //     },
  //     egress_id: ""
  //   }`
  // const recDataJson = JSON.parse(recData)
  // console.log(recDataJson);


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

app.post("/webhook", async (req, res) => {
  const { type } = req.body;
  if (type === 'call.recording_ready') {
    console.log(req.body);
    const { call_cid } = req.body
    const { url: videoUrl, filename } = req.body.call_recording;

    // console.log(typeof (req.body.call_recording))
    // console.log(call_cid)
    // console.log(filename)
    // console.log(typeof (videoUrl))
    // console.log(typeof (call_cid))
    // console.log(typeof (filename))
    const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    // const mp4Buffer = await convertMp4FromUrl(response.data);
    const buffer = Buffer.from(response.data);
    // const existing = readData();
    const client = new StreamClient(process.env.STREAM_IO_APIKEY, process.env.STREAM_IO_SECRET);
    const call = await client.video.getCall({
      id: call_cid.split(":")[1],
      type: "default"
    })
    const username = call.call.created_by.name
    const meetingChunks = filename.split("_")
    const meetingChunkName = meetingChunks[meetingChunks.length - 1]
    const blobName = `${username}/${call_cid.split(":")[1]}/meeting_part${meetingChunkName}`;
    console.log(call.call.created_by.name);
    const blobClient = storageContainerClient.getBlockBlobClient(blobName);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: 'video/mp4'
      }
    });

    // const blobClient = storageContainerClient.getBlockBlobClient(blobName);
    // writeData([...existing, newRecord]);
    // {
    //   type: 'call.recording_ready',
    //     created_at: '2025-06-06T21:23:00.427846676Z',
    //       call_cid: 'default:2025-06-06_1015',
    //         call_recording: {
    //     filename: 'rec_default_2025-06-06_1015_720p_1749244938038.mp4',
    //       url: 'https://us-east.stream-io-cdn.com/1388924/video/recordings/default_2025-06-06_1015/rec_default_2025-06-06_1015_720p_1749244938038.mp4?Expires=1750454580&Signature=e2JtlLOq0NhClHKvY8QeVoHEhF3yrCQjQnlkp9jrEVN-mK81xcUbupNkS8XFYeVgpOheJRiOvObO4uUcrwkDTeOph3HOI334lR1KDoEvuxIBfvNXI0-bz4CHy1DH7FPeKqpvVvIsjMjyNeiKKm5yfCk1y~NSFW229MUWaBJqUy~Vqp45LGFno2f9~SBIKJOshrk6wkzrZ1OfCwJSXSWDmmu8ERe~j5zVnTw6KRet3wFMyB7ajDWEs2Xr5OEa7ETf-V3OMFSesA9ek5KGzh0t76sF8mg9UErRg0RnrbRhOm6Vkyl-OznSd7fjvOCNj3bwK6b2fQ1GB1mzOTyqfAjCdw__&Key-Pair-Id=APKAIHG36VEWPDULE23Q',
    //         start_time: '2025-06-06T21:22:22.891526071Z',
    //           end_time: '2025-06-06T21:22:53.691208901Z',
    //             session_id: '6680d971-2036-4627-9baa-84684a536f34'
    //   },
    //   egress_id: ""
    // }


    console.log(`✅ Saved recording for ${call_cid}`);
    return res.status(200).json(newRecord);
  }

  // res.sendStatus(204); // ignored
})

httpServer.listen(PORT, () =>
  console.log(`server is running on port: ${PORT}`)
);
