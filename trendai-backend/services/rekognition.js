const { RekognitionClient, DetectLabelsCommand } = require("@aws-sdk/client-rekognition");
const fs = require("fs");

const client = new RekognitionClient({
  region: "ap-southeast-2"
});

async function detectLabels(imagePath) {

  const image = fs.readFileSync(imagePath);

  const command = new DetectLabelsCommand({
    Image: { Bytes: image },
    MaxLabels: 10
  });

  const response = await client.send(command);

  return response.Labels;
}

module.exports = detectLabels;