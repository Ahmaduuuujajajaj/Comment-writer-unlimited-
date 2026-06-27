import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import os from "os";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
app.use(express.json());

// Setup multer for file uploads
const upload = multer({
  dest: os.tmpdir(), // Use OS temp directory
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB limit
});

// Initialize Gemini SDK
// We lazily initialize to avoid crashing if the key isn't set yet.
let aiClient: GoogleGenAI | null = null;
function getAi() {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Route for generating comments
app.post("/api/generate-comments", upload.single("video"), async (req, res) => {
  let fileToCleanUp: string | null = null;
  let geminiFileName: string | null = null;
  const ai = getAi();

  try {
    const file = req.file;
    const { count } = req.body;
    const numComments = parseInt(count || "10", 10);

    if (!file) {
      return res.status(400).json({ error: "No video file provided." });
    }
    fileToCleanUp = file.path;

    if (!file.mimetype.startsWith("video/")) {
      return res.status(400).json({ error: "Uploaded file must be a video." });
    }

    console.log(`Uploading ${file.originalname} to Gemini...`);
    const uploadResult = await ai.files.upload({
      file: file.path,
      config: {
        mimeType: file.mimetype,
      }
    });
    
    geminiFileName = uploadResult.name;

    console.log(`Uploaded to Gemini as ${geminiFileName}. Waiting for processing...`);
    
    // Wait for the file to be processed
    let fileInfo = await ai.files.get({ name: geminiFileName });
    while (fileInfo.state === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      fileInfo = await ai.files.get({ name: geminiFileName });
    }

    if (fileInfo.state === "FAILED") {
      throw new Error("Video processing failed in Gemini.");
    }

    console.log(`Video processing complete. Generating ${numComments} comments...`);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { fileData: { fileUri: fileInfo.uri, mimeType: fileInfo.mimeType } },
        `You are a realistic user on social media. Watch this video and write exactly ${numComments} unique, human-like, natural comments related to the content of this video. The comments should sound like real people reacting on platforms like TikTok or Instagram (use some emojis, varied punctuation, and natural slang).`
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            description: "A single human-like comment",
          },
        },
      },
    });

    const commentsJson = response.text;
    const comments = JSON.parse(commentsJson);

    res.json({ comments });
  } catch (error: any) {
    console.error("Error generating comments:", error);
    res.status(500).json({ error: error.message || "An error occurred during generation." });
  } finally {
    // Clean up local temp file
    if (fileToCleanUp && fs.existsSync(fileToCleanUp)) {
      try {
        fs.unlinkSync(fileToCleanUp);
      } catch (err) {
        console.error("Failed to delete local temp file:", err);
      }
    }
    // Clean up Gemini file
    if (geminiFileName) {
      try {
        const ai = getAi();
        await ai.files.delete({ name: geminiFileName });
        console.log(`Deleted file ${geminiFileName} from Gemini.`);
      } catch (err) {
        console.error("Failed to delete file from Gemini:", err);
      }
    }
  }
});

// Setup Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
