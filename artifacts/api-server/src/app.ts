import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { existsSync } from "node:fs";
import router from "./routes";
import proxyRouter from "./routes/proxy";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", router);
app.use("/v1", proxyRouter);

const staticDir = process.env["STATIC_DIR"];
if (staticDir && existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile("index.html", { root: staticDir });
  });
  logger.info(`Serving static portal from ${staticDir}`);
}

export default app;
