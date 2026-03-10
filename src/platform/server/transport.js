import { existsSync } from "fs";
import { join } from "path";
import express from "express";

export function bindSpaRoutes(app, distDir) {
  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) {
        next();
        return;
      }
      res.sendFile(join(distDir, "index.html"));
    });
    return;
  }
  app.get("/", (_req, res) => {
    res.type("text/plain").send("Frontend build not found. Run `npm run build` or `npm run dev`.");
  });
}
