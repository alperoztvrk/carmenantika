export const config = { maxDuration: 10 };

export default function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.end("ok");
}
