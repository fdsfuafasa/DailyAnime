export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const method = request.method;

      // 查询所有
      if (url.pathname === "/api/users" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM test").all();
        return Response.json(results);
      }

      // 新增
      if (url.pathname === "/api/users" && method === "POST") {
        const body = await request.json();
        const test1 = body.test1;
        const test2 = body.test2;

        await env.DB.prepare(
          "INSERT INTO test (test1, test2) VALUES (?, ?)"
        ).bind(test1, test2).run();

        return Response.json({ ok: true, msg: "添加成功" });
      }

      return new Response("运行正常", { status: 200 });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 200 });
    }
  }
};