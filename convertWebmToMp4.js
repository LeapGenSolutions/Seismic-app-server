const { spawn } = require('child_process');
const { PassThrough } = require('stream');

const convertMp4FromUrl = (inputStream) => {
  return new Promise((resolve, reject) => {
    const outputStream = new PassThrough();
    const chunks = [];

    outputStream.on('data', (chunk) => chunks.push(chunk));
    outputStream.on('end', () => resolve(Buffer.concat(chunks)));
    outputStream.on('error', reject);

    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-f', 'mp4',
      '-vcodec', 'libx264',
      '-movflags', 'frag_keyframe+empty_moov',
      '-preset', 'ultrafast',
      '-y', 'pipe:1'
    ]);

    ffmpeg.stdin.on('error', reject);
    ffmpeg.stderr.on('data', (data) => console.log(`FFmpeg log: ${data}`));
    ffmpeg.on('error', reject);

    inputStream.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(outputStream);
  });
};

module.exports = {
    convertMp4FromUrl
}