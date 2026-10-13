import path from "node:path";

export function dataFile(name: string) {
  const root = process.env.VERCEL ? "/tmp" : ".data";
  return path.resolve(root, name);
}
