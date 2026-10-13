export const config = { maxDuration: 10 };

export default async function handler(_req, res) {
  try {
    if (res && typeof res.end === "function") {
      res.statusCode = 200;
      if (typeof res.setHeader === "function") {
        res.setHeader("content-type", "text/plain; charset=utf-8");
      }
      res.end("ok");
      return;
    }
  } catch (error) {
    console.error("[healthz]", error instanceof Error ? error.message : error);
  }
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
