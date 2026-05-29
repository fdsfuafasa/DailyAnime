export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. 查询所有数据
    if (path === "/api/users" && method === "GET") {
      try {
        const { results } = await env.DB.prepare("SELECT test1, test2 FROM test").all();
        return Response.json(results);
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // 2. 新增数据
    if (path === "/api/users" && method === "POST") {
      try {
        const { test1, test2 } = await request.json();
        await env.DB.prepare(
          "INSERT INTO test (test1, test2) VALUES (?, ?)"
        ).bind(test1, test2).run();
        return Response.json({ ok: true, msg: "添加成功" });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // 3. 更新数据
    if (path === "/api/users/update" && method === "POST") {
      try {
        const { test1, test2 } = await request.json();
        await env.DB.prepare(
          "UPDATE test SET test2 = ? WHERE test1 = ?"
        ).bind(test2, test1).run();
        return Response.json({ ok: true, msg: "更新成功" });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // 4. 删除数据
    if (path === "/api/users/delete" && method === "POST") {
      try {
        const { test1 } = await request.json();
        await env.DB.prepare(
          "DELETE FROM test WHERE test1 = ?"
        ).bind(test1).run();
        return Response.json({ ok: true, msg: "删除成功" });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return new Response("API 运行正常！数据库已连接", { status: 200 });
  }
};