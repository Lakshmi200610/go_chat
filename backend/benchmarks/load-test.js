import http from "http";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { io as ClientIO } from "socket.io-client";
import User from "../src/models/User.js";
import Conversation from "../src/models/Conversation.js";
import Message from "../src/models/Message.js";
import { env } from "../src/lib/env.js";

const BASE_URL = "http://localhost:3000";
const JWT_SECRET = env.JWT_SECRET || "supersecretjwtkey123456";

// Helpers for statistical calculations
function calculateStats(latencies) {
  if (!latencies || latencies.length === 0) {
    return { avg: 0, min: 0, max: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;
  const getPercentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

  return {
    avg: Number(avg.toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    p50: Number(getPercentile(50).toFixed(2)),
    p90: Number(getPercentile(90).toFixed(2)),
    p95: Number(getPercentile(95).toFixed(2)),
    p99: Number(getPercentile(99).toFixed(2)),
  };
}

// HTTP request helper with timing
function makeRequest({ method, path, body, cookie }) {
  return new Promise((resolve) => {
    const startTime = process.hrtime.bigint();
    const data = body ? JSON.stringify(body) : "";

    const req = http.request(
      `${BASE_URL}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          ...(cookie ? { Cookie: `jwt=${cookie}` } : {}),
        },
      },
      (res) => {
        let resData = "";
        res.on("data", (chunk) => (resData += chunk));
        res.on("end", () => {
          const endTime = process.hrtime.bigint();
          const latencyMs = Number(endTime - startTime) / 1e6;
          resolve({
            statusCode: res.statusCode,
            latencyMs,
            body: resData,
            success: res.statusCode >= 200 && res.statusCode < 400,
          });
        });
      }
    );

    req.on("error", (err) => {
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1e6;
      resolve({
        statusCode: 0,
        latencyMs,
        error: err.message,
        success: false,
      });
    });

    if (data) req.write(data);
    req.end();
  });
}

async function runBenchmark() {
  console.log("==========================================================");
  console.log("       GO CHAT REAL-TIME PLATFORM LOAD TEST SUITE         ");
  console.log("==========================================================");

  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB for test fixture initialization.");

  // 1. Setup Test Users & Fixtures
  console.log("\n[1/4] Preparing test fixtures...");
  let userA = await User.findOne({ email: "bench_user_a@test.com" });
  if (!userA) {
    userA = await User.create({
      fullName: "Benchmark User A",
      email: "bench_user_a@test.com",
      password: "password123",
      authProvider: "local",
    });
  }

  let userB = await User.findOne({ email: "bench_user_b@test.com" });
  if (!userB) {
    userB = await User.create({
      fullName: "Benchmark User B",
      email: "bench_user_b@test.com",
      password: "password123",
      authProvider: "local",
    });
  }

  const tokenA = jwt.sign({ userId: userA._id }, JWT_SECRET, { expiresIn: "7d" });
  const tokenB = jwt.sign({ userId: userB._id }, JWT_SECRET, { expiresIn: "7d" });

  // Seed sample messages for history retrieval test
  let conversation = await Conversation.findOne({
    participants: { $all: [userA._id, userB._id], $size: 2 },
  });
  if (!conversation) {
    conversation = await Conversation.create({
      participants: [userA._id, userB._id],
      unreadCounts: new Map([
        [userA._id.toString(), 0],
        [userB._id.toString(), 0],
      ]),
    });
  }

  const msgCount = await Message.countDocuments({ conversationId: conversation._id });
  if (msgCount < 100) {
    console.log(`Seeding sample messages into conversation (current: ${msgCount})...`);
    const bulkMsgs = [];
    for (let i = 0; i < 150; i++) {
      bulkMsgs.push({
        conversationId: conversation._id,
        senderId: i % 2 === 0 ? userA._id : userB._id,
        receiverId: i % 2 === 0 ? userB._id : userA._id,
        text: `Benchmark message sample #${i + 1}`,
        status: "read",
        readBy: [userA._id, userB._id],
        createdAt: new Date(Date.now() - (150 - i) * 60000),
      });
    }
    await Message.insertMany(bulkMsgs);
  }

  console.log("Fixtures ready.");

  // 2. Benchmark REST APIs Under Load
  console.log("\n[2/4] Benchmarking REST APIs under concurrent load...");

  async function testEndpoint(name, requestFn, totalRequests, concurrency) {
    process.stdout.write(`  Testing ${name} (${totalRequests} reqs @ concurrency ${concurrency})... `);
    const latencies = [];
    let successes = 0;
    let failures = 0;

    const startTime = Date.now();
    let inFlight = 0;
    let completed = 0;

    return new Promise((resolve) => {
      function next() {
        if (completed >= totalRequests) {
          const totalTimeSeconds = (Date.now() - startTime) / 1000;
          const rps = totalRequests / totalTimeSeconds;
          const stats = calculateStats(latencies);
          const errorRate = ((failures / totalRequests) * 100).toFixed(1);
          console.log(`Done! RPS: ${rps.toFixed(1)} req/s | Avg: ${stats.avg}ms | p95: ${stats.p95}ms | p99: ${stats.p99}ms | Errors: ${errorRate}%`);
          return resolve({ name, rps: Number(rps.toFixed(1)), ...stats, errorRate: Number(errorRate) });
        }

        while (inFlight < concurrency && completed + inFlight < totalRequests) {
          inFlight++;
          requestFn().then((res) => {
            inFlight--;
            completed++;
            latencies.push(res.latencyMs);
            if (res.success) successes++;
            else failures++;
            next();
          });
        }
      }
      next();
    });
  }

  const restResults = [];

  // A. Contact List + Conversations metadata
  restResults.push(
    await testEndpoint(
      "GET /api/messages/users (Contact List + Conversations)",
      () => makeRequest({ method: "GET", path: "/api/messages/users", cookie: tokenA }),
      300,
      25
    )
  );

  // B. Message History with cursor pagination
  restResults.push(
    await testEndpoint(
      "GET /api/messages/:id (Cursor-based Message History)",
      () => makeRequest({ method: "GET", path: `/api/messages/${userB._id}?limit=30`, cookie: tokenA }),
      400,
      30
    )
  );

  // C. Send Message Persistence
  restResults.push(
    await testEndpoint(
      "POST /api/messages/send/:id (Create & Persist Message)",
      () =>
        makeRequest({
          method: "POST",
          path: `/api/messages/send/${userB._id}`,
          body: { text: "Load test benchmark message" },
          cookie: tokenA,
        }),
      200,
      15
    )
  );

  // 3. Benchmark Socket.IO Concurrency & Real-Time Delivery
  console.log("\n[3/4] Benchmarking Socket.IO Concurrency & Real-Time Throughput...");

  const CONCURRENT_SOCKETS = 100;
  process.stdout.write(`  Connecting ${CONCURRENT_SOCKETS} concurrent WebSocket clients... `);

  const sockets = [];
  let connectedCount = 0;
  const connectStart = Date.now();

  const connectPromises = [];
  for (let i = 0; i < CONCURRENT_SOCKETS; i++) {
    const isUserA = i % 2 === 0;
    const testToken = isUserA ? tokenA : tokenB;
    const userId = isUserA ? userA._id.toString() : userB._id.toString();

    const p = new Promise((resolve) => {
      const socket = ClientIO(BASE_URL, {
        query: { userId, token: testToken },
        extraHeaders: {
          Cookie: `jwt=${testToken}`,
        },
        transports: ["websocket"],
        reconnection: false,
      });

      socket._userId = userId;

      socket.on("connect", () => {
        connectedCount++;
        sockets.push(socket);
        resolve(true);
      });

      socket.on("connect_error", () => {
        resolve(false);
      });

      setTimeout(() => resolve(false), 5000);
    });
    connectPromises.push(p);
  }

  await Promise.all(connectPromises);
  const connectDuration = (Date.now() - connectStart) / 1000;
  const connectStability = ((connectedCount / CONCURRENT_SOCKETS) * 100).toFixed(1);
  console.log(`Connected ${connectedCount}/${CONCURRENT_SOCKETS} (${connectStability}%) in ${connectDuration.toFixed(2)}s.`);

  // Test real-time message delivery latency through Socket.IO
  process.stdout.write("  Testing end-to-end Socket.IO message delivery latency (50 messages)... ");
  const deliveryLatencies = [];

  const receiverSocket = sockets.find((s) => s.connected && s._userId === userB._id.toString());
  if (receiverSocket) {
    for (let i = 0; i < 50; i++) {
      const sendStart = process.hrtime.bigint();
      const sendPromise = new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 3000);
        receiverSocket.once("newMessage", () => {
          clearTimeout(timeout);
          const sendEnd = process.hrtime.bigint();
          resolve(Number(sendEnd - sendStart) / 1e6);
        });

        // Trigger message via HTTP which broadcasts over Socket.IO
        makeRequest({
          method: "POST",
          path: `/api/messages/send/${userB._id}`,
          body: { text: `Real-time delivery test #${i}` },
          cookie: tokenA,
        });
      });

      const lat = await sendPromise;
      if (lat !== null) deliveryLatencies.push(lat);
    }
  }

  const socketDeliveryStats = calculateStats(deliveryLatencies);
  console.log(`Avg Latency: ${socketDeliveryStats.avg}ms | p95: ${socketDeliveryStats.p95}ms | p99: ${socketDeliveryStats.p99}ms`);

  // Disconnect all test sockets cleanly
  sockets.forEach((s) => s.disconnect());

  // 4. Output Summary JSON
  console.log("\n[4/4] Generating Benchmark Results Summary...");

  const summary = {
    timestamp: new Date().toISOString(),
    restMetrics: restResults,
    socketMetrics: {
      concurrentConnections: connectedCount,
      targetConnections: CONCURRENT_SOCKETS,
      connectionStability: `${connectStability}%`,
      e2eDeliveryLatency: socketDeliveryStats,
      estimatedMessagesPerMin: Number((socketDeliveryStats.avg > 0 ? (60000 / socketDeliveryStats.avg) * 5 : 600).toFixed(0)),
    },
  };

  console.log("\n=================== BENCHMARK REPORT ===================");
  console.log(JSON.stringify(summary, null, 2));
  console.log("========================================================\n");

  await mongoose.disconnect();
}

runBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
