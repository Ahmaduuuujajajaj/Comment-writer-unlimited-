import { Request, Response } from 'express';
import multer from 'multer';
import os from 'os';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import util from 'util';

dotenv.config();

// Vercel disables body parsing if we set this config
export const config = {
  api: {
    bodyParser: false,
  },
};

const upload = multer({
  dest: os.tmpdir(), // Use OS temp directory
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB limit
});

const uploadMiddleware = util.promisify(upload.single("video"));

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

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await uploadMiddleware(req as any, res as any);
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse form data' });
    return;
  }

  let fileToCleanUp: string | null = null;
  let geminiFileName: string | null = null;
  const ai = getAi();

  try {
    const file = (req as any).file;
    const count = req.body?.count;
    const numComments = parseInt(count || "10", 10);

    if (!file) {
      res.status(400).json({ error: "No video file provided." });
      return;
    }
    fileToCleanUp = file.path;

    if (!file.mimetype.startsWith("video/")) {
      res.status(400).json({ error: "Uploaded file must be a video." });
      return;
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

    const commentsJson = response.text || '[]';
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
}
