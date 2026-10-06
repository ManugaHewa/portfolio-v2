import { createApp } from "./app.js";

const app = createApp();

const port = Number(process.env.PORT ?? 4000);
// Unset keeps Node's default of listening on every interface, which is what
// the server has always done. Set HOST=127.0.0.1 once Nginx proxies to
// 127.0.0.1:4000, so the API is reachable only through Nginx.
const host = process.env.HOST?.trim() || undefined;

if (process.env.NODE_ENV !== "test") {
  const ready = () => console.log(`API listening on http://${host ?? "localhost"}:${port}`);
  if (host) app.listen(port, host, ready);
  else app.listen(port, ready);
}
