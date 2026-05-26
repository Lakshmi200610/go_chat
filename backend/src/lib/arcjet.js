import arcjet, { tokenBucket } from "@arcjet/node";
import { env } from "./env.js";

let aj = null;

if (env.ARCJET_KEY) {
  aj = arcjet({
    key: env.ARCJET_KEY,
    characteristics: ["ip.src"],
    rules: [
      tokenBucket({
        mode: "LIVE",
        refillRate: 5,
        interval: 10,
        capacity: 10,
      }),
    ],
  });
}

export default aj;
