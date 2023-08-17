#!/usr/bin/env node
// (from: https://qiita.com/takayukioda/items/a149bc2907ef77121229)

import * as fs from "fs";
import * as http from "http";
import * as http2 from "http2";
import * as tls from "tls";
import * as log4js from "log4js";
import * as yargs from "yargs";

import * as piping from "./piping";
import {VERSION} from "./version";

// Create option parser
const parser = yargs
  .option("host", {
    describe: "Bind address (e.g. 127.0.0.1, ::1)",
    type: "string",
  })
  .option("http-port", {
    describe: "Port of HTTP server",
    default: 8080
  })
  .option("enable-https", {
    describe: "Enable HTTPS",
    boolean: true,
    default: false,
  })
  .option("https-port", {
    describe: "Port of HTTPS server",
    type: "number"
  })
  .option("key-path", {
    describe: "Private key path",
    type: "string"
  })
  .option("crt-path", {
    describe: "Certification path",
    type: "string"
  });

// Parse arguments
const args = parser.parseSync(process.argv.slice(2));
const host: string | undefined = args["host"];
const httpPort: number = args["http-port"];
const enableHttps: boolean = args["enable-https"];
const httpsPort: number | undefined = args["https-port"];
const serverKeyPath: string | undefined = args["key-path"];
const serverCrtPath: string | undefined = args["crt-path"];

// Create a logger
const logger = log4js.getLogger();
logger.level = "info";

// Create a piping server
const pipingServer = new piping.Server({ logger });

logger.info(`Piping Server ${VERSION}`);

http.createServer({
    requestTimeout: 0,
  },
  pipingServer.generateHandler(false),
)
  .listen({ host, port: httpPort }, () => {
    logger.info(`Listen HTTP on ${httpPort}...`);
  });

if (enableHttps) {
  if (httpsPort === undefined) {
    logger.error("--https-port is required");
    process.exit(1);
  }
  if (serverKeyPath === undefined) {
    logger.error("--key-path is required");
    process.exit(1);
  }
  if (serverCrtPath === undefined) {
    logger.error("--crt-path is required");
    process.exit(1);
  }

  const generateSecureContextOptions: () => tls.SecureContextOptions = () => ({
    key: fs.readFileSync(serverKeyPath),
    cert: fs.readFileSync(serverCrtPath),
  });
  const http2Server = http2.createSecureServer(
    {
      ...generateSecureContextOptions(),
      allowHTTP1: true
    },
    pipingServer.generateHandler(true)
  );
  const updateSecureContext = () => {
    try {
      http2Server.setSecureContext(generateSecureContextOptions());
      logger.info("Certificate loaded");
    } catch (e) {
      logger.error("Failed to load certificate", e);
    }
  };
  fs.watchFile(serverCrtPath, updateSecureContext);
  fs.watchFile(serverKeyPath, updateSecureContext);
  http2Server.listen({ host, port: httpsPort }, () => {
    logger.info(`Listen HTTPS on ${httpsPort}...`);
  });
}

// Catch and ignore error
process.on("uncaughtException", (err) => {
  logger.error("on uncaughtException", err);
});
