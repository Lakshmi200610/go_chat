import { Resend } from "resend";
import { env } from "./env.js";

let resend = null;

if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
}

export default resend;
