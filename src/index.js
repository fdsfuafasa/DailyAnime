export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const method = request.method;

      // 注册
      if (url.pathname === "/api/register" && method === "POST") {
        const { username, password, confirmPassword, email, confirmEmail } = await request.json();
        if (!username || !password || !email) return Response.json({ ok: false, msg: "请填写所有字段" });
        if (password !== confirmPassword) return Response.json({ ok: false, msg: "两次密码不一致" });
        if (email !== confirmEmail) return Response.json({ ok: false, msg: "两个邮箱不一致" });
        const exists = await env.DB.prepare("SELECT username FROM users WHERE username = ?").bind(username).first();
        if (exists) return Response.json({ ok: false, msg: "用户名已存在" });
        await env.DB.prepare("INSERT INTO users (username, password, email, coins) VALUES (?,?,?,0)").bind(username, password, email).run();
        return Response.json({ ok: true, msg: "注册成功" });
      }

      // 登录
      if (url.pathname === "/api/login" && method === "POST") {
        const { username, password } = await request.json();
        const user = await env.DB.prepare("SELECT username FROM users WHERE username=? AND password=?").bind(username, password).first();
        if (!user) return Response.json({ ok: false, msg: "用户名或密码错误" });
        return Response.json({ ok: true, msg: "登录成功", user: username });
      }

      // 游客
      if (url.pathname === "/api/guest" && method === "GET") {
        return Response.json({ ok: true, msg: "已进入游客模式" });
      }

      // 找回密码
      if (url.pathname === "/api/forgot" && method === "POST") {
        const { username, email } = await request.json();
        const user = await env.DB.prepare("SELECT username FROM users WHERE username=? AND email=?").bind(username, email).first();
        if (!user) return Response.json({ ok: false, msg: "用户名与邮箱不匹配" });
        return Response.json({ ok: true, msg: "验证成功，请重置密码" });
      }

      // 重置密码
      if (url.pathname === "/api/reset" && method === "POST") {
        const { username, newPassword, confirmPassword } = await request.json();
        if (newPassword !== confirmPassword) return Response.json({ ok: false, msg: "两次密码不一致" });
        await env.DB.prepare("UPDATE users SET password=? WHERE username=?").bind(newPassword, username).run();
        return Response.json({ ok: true, msg: "密码重置成功！" });
      }

      // 用户信息（金币 + 已购类型）
      if (url.pathname === "/api/userinfo" && method === "POST") {
        const { username } = await request.json();
        const user = await env.DB.prepare("SELECT username, coins FROM users WHERE username=?").bind(username).first();
        const items = await env.DB.prepare("SELECT item_id, type FROM user_items WHERE username=?").bind(username).all();
        // 返回已购买数组，包含 item_id 与 type
        const bought = items.results.map(i => ({ item_id: i.item_id, type: i.type }));
        return Response.json({ ok: true, user, bought });
      }

      // 签到
      if (url.pathname === "/api/sign" && method === "POST") {
        const { username } = await request.json();
        const today = new Date().toISOString().split("T")[0];
        const signed = await env.DB.prepare("SELECT * FROM sign_in WHERE username=? AND date=?").bind(username, today).first();
        if (signed) return Response.json({ ok: false, msg: "今天已签到" });
        await env.DB.prepare("INSERT INTO sign_in (username, date) VALUES (?,?)").bind(username, today).run();
        await env.DB.prepare("UPDATE users SET coins=coins+1 WHERE username=?").bind(username).run();
        const u = await env.DB.prepare("SELECT coins FROM users WHERE username=?").bind(username).first();
        return Response.json({ ok: true, msg: "签到成功 +1金币", coins: u.coins });
      }

      // ====================== 商品功能 ======================
      // 获取所有商品
      if (url.pathname === "/api/items" && method === "GET") {
        const items = await env.DB.prepare("SELECT * FROM items").all();
        return Response.json({ ok: true, items: items.results });
      }

      // 购买商品（按类型购买，固定价格 1）
      if (url.pathname === "/api/buy" && method === "POST") {
        const { username, item_id, type } = await request.json();
        const user = await env.DB.prepare("SELECT coins FROM users WHERE username=?").bind(username).first();
        const item = await env.DB.prepare("SELECT link_1, link_2, link_3 FROM items WHERE id=?").bind(item_id).first();
        if (!user || !item) return Response.json({ ok: false, msg: "用户或商品不存在" });
        const typeField = `link_${type}`;
        if (!item[typeField] || item[typeField].toString().trim() === "") return Response.json({ ok: false, msg: "该类型尚未上架" });
        const price = 1;
        if (user.coins < price) return Response.json({ ok: false, msg: "金币不足" });
        const exist = await env.DB.prepare("SELECT * FROM user_items WHERE username=? AND item_id=? AND type=?").bind(username, item_id, type).first();
        if (exist) return Response.json({ ok: false, msg: "已购买过该商品类型" });

        await env.DB.prepare("INSERT INTO user_items (username, item_id, type) VALUES (?,?,?)").bind(username, item_id, type).run();
        await env.DB.prepare("UPDATE users SET coins=coins-? WHERE username=?").bind(price, username).run();

        const newUser = await env.DB.prepare("SELECT coins FROM users WHERE username=?").bind(username).first();
        return Response.json({ ok: true, msg: "购买成功", coins: newUser.coins });
      }

      return env.ASSETS.fetch(request);
    } catch (e) {
      return Response.json({ ok: false, error: e.message });
    }
  }
};