import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors({ origin: "http://localhost:5173" })); // ganti saat deploy
app.use(express.json());

app.post("/api/hint", async (req, res) => {
  const { encodedText, attemptCount } = req.body;

  if (!encodedText) return res.status(400).json({ error: "Missing encodedText" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `Kamu adalah mentor CTF yang membantu siswa belajar encoding dan decoding.
        Berikan petunjuk singkat dalam bahasa Indonesia tanpa mengungkap jawabannya.
        Fokus pada pola karakter atau petunjuk visual dari teks.
        Maksimal 2 kalimat dan jangan menyebut jenis encoding secara langsung.`,
        messages: [
          {
            role: "user",
            content: `Attempt #${attemptCount}. Challenge: "${encodedText.slice(0, 80)}". Give a hint.`,
          },
        ],
      }),
    });

    const data = await response.json();
    const hint = data.content?.[0]?.text || "Look carefully at the character set.";
    res.json({ hint });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch hint" });
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log(`Backend running on port ${process.env.PORT || 3001}`);
});
