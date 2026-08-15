import axios from "axios";
import { BASE_URL } from "./constants.js";

export const axiosInstance = axios.create({
  baseURL: BASE_URL ? `${BASE_URL}/api` : "/api",
  withCredentials: true,
});

