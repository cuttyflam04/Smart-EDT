import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for feedback
  app.post("/api/feedback", async (req, res) => {
    const { type, title, description } = req.body;
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not defined");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    const color = type === 'bug' ? 0xFF0000 : 0xFFD700; // Red for bug, Gold for idea
    const emoji = type === 'bug' ? '🐛' : '💡';

    const payload = {
      embeds: [
        {
          title: `${emoji} Nouveau Feedback : ${type.toUpperCase()}`,
          color: color,
          fields: [
            {
              name: "Titre",
              value: title || "Sans titre",
            },
            {
              name: "Description",
              value: description || "Pas de description",
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Smart EDT Feedback System",
          },
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        res.json({ success: true });
      } else {
        const errorText = await response.text();
        console.error("Discord API error:", errorText);
        res.status(500).json({ error: "Failed to send to Discord" });
      }
    } catch (error) {
      console.error("Error sending to Discord:", error);
      res.status(500).json({ error: "Internal server error" });
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
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
