export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const method = request.method;

      // 查询全部
      if (url.pathname === "/api/users" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM test").all();
        return Response.json(results);
      }

      // 新增数据
      if (url.pathname === "/api/users" && method === "POST") {
        const { test1, test2 } = await request.json();
        await env.DB.prepare("INSERT INTO test (test1, test2) VALUES (?, ?)")
          .bind(test1, test2).run();
        return Response.json({ ok: true, msg: "添加成功" });
      }

      // 更新数据（根据 test1 匹配）
      if (url.pathname === "/api/update" && method === "POST") {
        const { test1, test2 } = await request.json();
        await env.DB.prepare("UPDATE test SET test2 = ? WHERE test1 = ?")
          .bind(test2, test1).run();
        return Response.json({ ok: true, msg: "更新成功" });
      }

      // 删除数据（根据 test1 匹配）
      if (url.pathname === "/api/delete" && method === "POST") {
        const { test1 } = await request.json();
        await env.DB.prepare("DELETE FROM test WHERE test1 = ?")
          .bind(test1).run();
        return Response.json({ ok: true, msg: "删除成功" });
      }

      // 走静态页面
      return env.ASSETS.fetch(request);
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }
};