// Minimal static server for the NEMI Basic site.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = 4100;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/") url = "/index.html";
    let file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("forbidden");
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/html" });
        return res.end("<h1>404</h1>");
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`NEMI Basic on http://localhost:${PORT}`));
