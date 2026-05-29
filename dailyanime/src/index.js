export default {
  async fetch(request, env) {
    return new Response("✅ Worker 正常运行！", {
      headers: { "Content-Type": "text/plain" }
    });
  }
};