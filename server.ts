import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = 3000;

// Set up body parsers (large limit for base64 camera photos)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initializer for Gemini Client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not configured on the server. Please add it to your secrets or environment variables.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const FALLBACK_MODELS: Record<string, string[]> = {
  "gemini-3.5-flash": ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"],
  "gemini-3.1-flash-lite": ["gemini-3.1-flash-lite", "gemini-flash-latest"],
  "gemini-flash-latest": ["gemini-flash-latest", "gemini-3.1-flash-lite"]
};

/**
 * Executes a Gemini API call with automatic retries for transient errors (e.g. 503 UNAVAILABLE, 429 rate limit).
 * Utilizes exponential backoff to handle temporary Service Unavailable states gracefully.
 * Cascades to highly available alternative models (e.g., gemini-3.1-flash-lite, gemini-flash-latest) if the primary model is overwhelmed.
 */
async function generateContentWithRetry(
  params: {
    model?: string;
    contents: any;
    config?: any;
  },
  maxRetries = 3,
  initialDelayMs = 1500
) {
  const originalModel = params.model || "gemini-3.5-flash";
  const modelChain = FALLBACK_MODELS[originalModel] || [originalModel];
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    // Select model for current attempt. Fall back sequentially or stick to the last one if we exceed the chain
    const currentModel = modelChain[Math.min(attempt - 1, modelChain.length - 1)];

    try {
      const ai = getGeminiClient();
      console.log(`[Gemini API] Attempt ${attempt}: calling generateContent with model ${currentModel}`);
      return await ai.models.generateContent({
        ...params,
        model: currentModel,
      });
    } catch (error: any) {
      console.warn(`[Gemini API Attempt ${attempt} / ${maxRetries + 1} failed with model ${currentModel}]:`, error?.message || error);
      
      const errorStr = String(error?.message || error || "").toUpperCase();
      const isTransient = 
        errorStr.includes("503") || 
        errorStr.includes("UNAVAILABLE") ||
        errorStr.includes("LIMIT") || 
        errorStr.includes("429") ||
        errorStr.includes("HIGH DEMAND") ||
        error?.status === 503 ||
        error?.status === 429;

      if (!isTransient || attempt > maxRetries) {
        throw error;
      }

      console.log(`Retrying in ${delayMs}ms using model fallback chain from ${currentModel}...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2.0; // exponential backoff
    }
  }
  throw new Error("Content generation failed after retries.");
}

// Backend API Routes
app.post("/api/pharma/identify", async (req, res, next) => {
  try {
    const { base64Image, textDescription } = req.body;
    if (!base64Image && !textDescription) {
      return res.status(400).json({ error: "Either a visual image payload or a text description must be supplied." });
    }

    let response;

    if (base64Image) {
      const prompt = `Identify this medicine from the image. Provide the following details in a structured, beautifully aligned markdown format:

1. **Medicine Name** (Brand and Generic)
2. **Medical Conditions Treated (Why This Medicine is Used)**
   - Exhaustive explanation of what diseases, symptoms, or health conditions this medicine is used for.
3. **Age-Specific Dosage Information**
   - Provide recommended standard dosages with clear, specific guidelines for the following age cohorts:
     * **Infants & Toddlers (under 2 years)**
     * **Children (2 - 12 years)**
     * **Teens & Adults (13 - 64 years)**
     * **Elderly (65+ years)**
4. **Treatment Duration (How many days needed)**
   - Clearly describe how many days this medicine needs to be taken for each different condition/disease it treats. State any factors affecting duration.
5. **Brand Alternatives** (Other common brands with exactly the same chemical composition/generic formulation)
6. **Chemical Compounds** (Active chemical ingredients)
7. **Precautions & Warnings** (Contraindications, warnings about self-medication, storage requirements)

**IMPORTANT DISCLAIMER**: Always add a highly visible disclaimer at the beginning or end stating that this is AI-generated informational content and not a substitute for professional medical/clinical advice, diagnosis, or treatment.`;

      response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Image } },
            { text: prompt },
          ],
        },
        config: {
          temperature: 0.1,
        },
      });
    } else {
      const prompt = `Identify this medicine based on the following physical description or characteristics provided by the user: "${textDescription}". 
Analyze the physical traits (such as shape, color, imprint codes, division line, or name) to determine the candidate medicine(s). 
Provide the following details in a structured, beautifully aligned markdown format:

1. **Identified Medicine Candidate(s)** (Brand, Generic names, and standard strengths)
2. **Medical Conditions Treated (Why This Medicine is Used)**
   - Exhaustive explanation of what diseases, symptoms, or health conditions this medicine is used for.
3. **Age-Specific Dosage Information**
   - Provide recommended standard dosages with clear, specific guidelines for the following age cohorts:
     * **Infants & Toddlers (under 2 years)**
     * **Children (2 - 12 years)**
     * **Teens & Adults (13 - 64 years)**
     * **Elderly (65+ years)**
4. **Treatment Duration (How many days needed)**
   - Clearly describe how many days this medicine needs to be taken for each different condition/disease it treats. State any factors affecting duration.
5. **Brand Alternatives** (Other common brands with exactly the same chemical composition/generic formulation)
6. **Chemical Compounds** (Active chemical ingredients)
7. **Precautions & Warnings** (Contraindications, warnings about self-medication, storage requirements)

**IMPORTANT DISCLAIMER**: Always add a highly visible disclaimer at the beginning or end stating that this is AI-generated informational content and not a substitute for professional medical/clinical advice, diagnosis, or treatment.`;

      response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2,
        },
      });
    }

    res.json({ result: response.text || "Could not identify medicine." });
  } catch (error: any) {
    console.error("Error identifying medicine:", error);
    res.status(500).json({ error: error.message || "Failed to analyze medicine." });
  }
});

app.post("/api/pharma/disease", async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Missing query parameter." });
    }

    const prompt = `List common medicines used for treating the disease: "${query}". For each medicine listed, provide the following clinical reference in a structured markdown format:

- **Name** (Generic formulation and common commercial brands)
- **Why It is Used (Under Which Conditions)**
  - Detailed description of why this specific medicine is prescribed for "${query}" (e.g., relief of specific symptoms, target infection, etc.).
- **Age-Specific Dosage**
  - Clinical dosage breakdown by age groups:
    * **Infants & Children**
    * **Teens & Adults**
    * **Elderly**
- **Treatment Duration (Days Needed)**
  - Specify how many days the patient typically needs to take this medicine for each condition or severity level of "${query}".
- **Mechanism of Action** (How it operates inside the body in simple layman terms)
- **Chemical Composition** (Active components)

**IMPORTANT DISCLAIMER**: Always add a highly visible disclaimer at the beginning or end stating that this is AI-generated informational content and not a substitute for professional medical/clinical advice, diagnosis, or treatment.`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    res.json({ result: response.text || "No clinical information found." });
  } catch (error: any) {
    console.error("Error fetching medicine by disease:", error);
    res.status(500).json({ error: error.message || "Search failed." });
  }
});

app.post("/api/pharma/alternatives", async (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Missing query parameter." });
    }

    const prompt = `Provide a list of brand-name medicines that contain "${query}" as their active ingredient or generic formula. In addition to listing the alternative brands, describe the chemical composition, typical dosage forms (tablets, syrups, drops, IV, etc.), and provide the following medical details in structured markdown:

1. **Why It is Used (Conditions Treated)**
   - Clear details on why someone uses "${query}" and what symptoms or conditions it addresses.
2. **Age-Specific Dosage Guidelines**
   - Provide standard recommended dosage schedules for:
     * **Children** 
     * **Adults**
     * **Elderly**
3. **Required Treatment Duration**
   - Clarify how many days (or timeframe) this medicine typically needs to be consumed for each of the main conditions.

**IMPORTANT DISCLAIMER**: Always add a highly visible disclaimer at the beginning or end stating that this is AI-generated informational content and not a substitute for professional medical/clinical advice, diagnosis, or treatment.`;

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    res.json({ result: response.text || "No information found." });
  } catch (error: any) {
    console.error("Error fetching alternatives:", error);
    res.status(500).json({ error: error.message || "Search failed." });
  }
});

// Error handling middleware to catch unhandled errors and return JSON instead of HTML
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express Global Error Handler caught:", err);
  res.status(500).json({ error: err?.message || "An unexpected system error occurred on the server." });
});

// Configure Vite middleware in development or serve static build in production
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
