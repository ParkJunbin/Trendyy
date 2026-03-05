const express = require("express");
const multer = require("multer");
const detectLabels = require("../services/rekognition");

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("image"), async (req, res) => {

  try {

    const labels = await detectLabels(req.file.path);

    res.json({
      success: true,
      labels: labels
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

module.exports = router;