const { createClient } = require("redis");

const client = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

// Without this, a Redis error would crash the app
client.on("error", (err) => console.error("Redis error:", err.message));

// Do not await this before app.listen: if Redis is down it keeps retrying  
function connectRedis() {
  if (process.env.REDIS_ENABLED === "false") {
    console.log("Redis disabled, running without cache");
    return;
  }
  client
    .connect()
    .then(() => console.log("Connected to Redis"))
    .catch(() => console.error("Redis unavailable, running without cache"));
}

// Each helper skips Redis when it is not ready, so the cache can never break the app
async function cacheGet(key) {
  if (!client.isReady) return null;
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    return null;
  }
}

async function cacheSet(key, value, seconds) {
  if (!client.isReady) return;
  try {
    await client.set(key, JSON.stringify(value), { EX: seconds });
  } catch (err) {}
}

async function cacheDel(key) {
  if (!client.isReady) return;
  try {
    await client.del(key);
  } catch (err) {}
}

module.exports = { connectRedis, cacheGet, cacheSet, cacheDel };