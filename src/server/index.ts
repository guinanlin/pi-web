#!/usr/bin/env node
import { effectivePiWebConfig, maxUploadBytes } from "../config.js";
import { DEFAULT_WEB_PORT } from "../shared/defaultPorts.js";
import { buildApp } from "./app.js";

const { config } = effectivePiWebConfig();
const app = await buildApp({ bodyLimit: maxUploadBytes(process.env, config) });
await app.listen({ port: config.port ?? DEFAULT_WEB_PORT, host: config.host ?? "127.0.0.1" });
