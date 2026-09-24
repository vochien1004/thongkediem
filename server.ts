import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "20mb" }));

  // API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Gemini API analysis endpoint
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { prompt, systemInstruction } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(400).json({
          error: "Chưa cấu hình GEMINI_API_KEY trên môi trường server.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          systemInstruction:
            systemInstruction ||
            "Bạn là một chuyên gia khảo thí, đánh giá chất lượng giáo dục và cố vấn sư phạm chuyên sâu. Bạn phân tích dữ liệu điểm số một cách khách quan, chính xác, phát hiện điểm sáng, hạn chế và đưa ra các khuyến nghị hành động thiết thực cho nhà trường, giáo viên và phụ huynh bằng tiếng Việt chuẩn mực, tôn trọng và giàu tính xây dựng.",
          temperature: 0.7,
        },
      });

      return res.json({
        text: response.text || "Không có phản hồi từ AI.",
      });
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      return res.status(500).json({
        error: err?.message || "Đã xảy ra lỗi khi kết nối tới dịch vụ Gemini AI.",
      });
    }
  });

  // Vite middleware for development
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
    console.log(`EduScore AI server running on http://localhost:${PORT}`);
  });
}

startServer();
