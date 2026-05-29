/**
 * 测试 D1 数据库：user 表（id TEXT, num INTEGER）
 * 提供增删改查接口 + 静态页面
 */
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

    // 返回 public/index.html
    return env.ASSETS.fetch(request);
  }
};