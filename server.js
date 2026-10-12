// server.ts
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
var distDir = path.join(__dirname, "dist");
var publicDir = path.join(__dirname, "public");
app.post("/api/save-profile-photo", express.json({ limit: "15mb" }), (req, res) => {
  try {
    const { dataUrl } = req.body;
    if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const pubImgDir = path.join(publicDir, "images");
      if (!fs.existsSync(pubImgDir)) fs.mkdirSync(pubImgDir, { recursive: true });
      fs.writeFileSync(path.join(pubImgDir, "profile-photo.jpg"), buffer);
      const distImgDir = path.join(distDir, "images");
      if (fs.existsSync(distDir)) {
        if (!fs.existsSync(distImgDir)) fs.mkdirSync(distImgDir, { recursive: true });
        fs.writeFileSync(path.join(distImgDir, "profile-photo.jpg"), buffer);
      }
      return res.json({ success: true });
    }
    return res.status(400).json({ error: "invalid data" });
  } catch (err) {
    return res.status(500).json({ error: "failed to save" });
  }
});
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, {
    etag: false,
    lastModified: false,
    maxAge: 0
  }));
}
app.use(express.static(publicDir, {
  etag: false,
  lastModified: false,
  maxAge: 0
}));
app.get("*", (req, res, next) => {
  const cleanPath = req.path.replace(/^\//, "").replace(/\/$/, "");
  if (!cleanPath) {
    return next();
  }
  const candidateFiles = [
    path.join(publicDir, cleanPath, "index.html"),
    path.join(distDir, cleanPath, "index.html"),
    path.join(publicDir, cleanPath + ".html"),
    path.join(distDir, cleanPath + ".html")
  ];
  for (const file of candidateFiles) {
    if (fs.existsSync(file)) {
      return res.sendFile(file);
    }
  }
  next();
});
app.use((_req, res) => {
  const notFoundFile = fs.existsSync(path.join(publicDir, "404.html")) ? path.join(publicDir, "404.html") : fs.existsSync(path.join(distDir, "404.html")) ? path.join(distDir, "404.html") : null;
  if (notFoundFile) {
    res.status(404).sendFile(notFoundFile);
  } else {
    res.status(404).send("Page not found");
  }
});
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
