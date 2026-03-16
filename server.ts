import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";

dotenv.config();

// Load Firebase config for REST API
let firebaseConfig: any;
try {
  const configPath = join(process.cwd(), "firebase-applet-config.json");
  firebaseConfig = JSON.parse(readFileSync(configPath, "utf8"));
} catch (err) {
  console.error("Could not load firebase-applet-config.json");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());

  // API route for feedback
  app.post("/api/feedback", async (req, res) => {
    const { type, title, description, severity, category, userEmail, metadata } = req.body;
    
    let webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    // Fetch from Firestore REST API (Lightweight, no SDK needed)
    if (firebaseConfig) {
      try {
        const projectId = firebaseConfig.projectId;
        const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
        const apiKey = firebaseConfig.apiKey;
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/configs/global?key=${apiKey}`;
        
        const firestoreRes = await fetch(url);
        if (firestoreRes.ok) {
          const data = await firestoreRes.json();
          const remoteUrl = data.fields?.discordWebhookUrl?.stringValue;
          if (remoteUrl) {
            webhookUrl = remoteUrl;
          }
        }
      } catch (err) {
        console.error("Error fetching remote config:", err);
      }
    }

    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not defined");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    const colors: Record<string, number> = {
      bug: 0xFF0000, // Red
      idea: 0x00FF00, // Green
      other: 0x7289DA, // Discord Blue
      critical: 0x000000 // Black
    };

    const typeEmojis: Record<string, string> = {
      bug: '🐛',
      idea: '💡',
      other: '💬'
    };

    const severityEmojis: Record<string, string> = {
      low: '🔵',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    const color = severity === 'critical' ? colors.critical : (colors[type] || colors.other);
    const emoji = typeEmojis[type] || '❓';
    const sevEmoji = severityEmojis[severity as string] || '';

    const payload = {
      embeds: [
        {
          title: `${emoji} ${type.toUpperCase()} : ${title || "Sans titre"}`,
          description: description || "Pas de description",
          color: color,
          fields: [
            {
              name: "Catégorie",
              value: category || "Non spécifiée",
              inline: true
            },
            {
              name: "Priorité",
              value: `${sevEmoji} ${severity || "Normale"}`,
              inline: true
            },
            {
              name: "Utilisateur",
              value: userEmail || "Anonyme",
              inline: true
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Smart EDT Feedback System • v1.0.0",
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
