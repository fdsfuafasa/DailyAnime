export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. 查询所有用户
    if (path === "/api/users" && method === "GET") {
      try {
        const { results } = await env.DB.prepare("SELECT id, num FROM user").all();
        return Response.json(results);
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // 2. 新增用户
    if (path === "/api/users" && method === "POST") {
      try {
        const { id, num } = await request.json();
        await env.DB.prepare("INSERT INTO user (id, num) VALUES (?, ?)")
          .bind(id, num)
          .run();
        return Response.json({ ok: true, msg: "添加成功" });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // 3. 更新用户
    if (path === "/api/users/update" && method === "POST") {
      try {
        const { id, num } = await request.json();
        await env.DB.prepare("UPDATE user SET num = ? WHERE id = ?")
          .bind(num, id)
          .run();
        return Response.json({ ok: true, msg: "更新成功" });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // 4. 删除用户
    if (path === "/api/users/delete" && method === "POST") {
      try {
        const { id } = await request.json();
        await env.DB.prepare("DELETE FROM user WHERE id = ?")
          .bind(id)
          .run();
        return Response.json({ ok: true, msg: "删除成功" });
      } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    // 5. 返回静态文件（index.html）
    try {
      return await env.ASSETS.fetch(request);
    } catch (err) {
      // 如果静态文件不存在，返回一个简单的提示页面
      return new Response("静态文件未找到，请检查 public/index.html 是否存在", {
        status: 404,
        headers: { "Content-Type": "text/plain" }
      });
    }
  }
};