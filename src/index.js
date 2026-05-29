export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const method = request.method;

      // ==============================================
      // 1. 注册
      // ==============================================
      if (url.pathname === "/api/register" && method === "POST") {
        const { username, password, confirmPassword, email, confirmEmail } = await request.json();

        if (!username || !password || !email) return Response.json({ ok: false, msg: "请填写所有字段" });
        if (password !== confirmPassword) return Response.json({ ok: false, msg: "两次密码不一致" });
        if (email !== confirmEmail) return Response.json({ ok: false, msg: "两个邮箱不一致" });

        const exists = await env.DB.prepare("SELECT username FROM users WHERE username = ?").bind(username).first();
        if (exists) return Response.json({ ok: false, msg: "用户名已存在" });

        await env.DB.prepare("INSERT INTO users (username, password, email, coins) VALUES (?,?,?,0)")
          .bind(username, password, email).run();

        return Response.json({ ok: true, msg: "注册成功" });
      }

      // ==============================================
      // 2. 登录
      // ==============================================
      if (url.pathname === "/api/login" && method === "POST") {
        const { username, password } = await request.json();
        const user = await env.DB.prepare("SELECT username FROM users WHERE username=? AND password=?")
          .bind(username, password).first();

        if (!user) return Response.json({ ok: false, msg: "用户名或密码错误" });
        return Response.json({ ok: true, msg: "登录成功", user: username });
      }

      // ==============================================
      // 3. 游客模式
      // ==============================================
      if (url.pathname === "/api/guest" && method === "GET") {
        return Response.json({ ok: true, msg: "已进入游客模式" });
      }

      // ==============================================
      // 4. 找回密码（验证用户名 + 邮箱）
      // ==============================================
      if (url.pathname === "/api/forgot" && method === "POST") {
        const { username, email } = await request.json();
        const user = await env.DB.prepare("SELECT username FROM users WHERE username=? AND email=?")
          .bind(username, email).first();

        if (!user) return Response.json({ ok: false, msg: "用户名与邮箱不匹配" });
        return Response.json({ ok: true, msg: "验证成功，请重置密码" });
      }

      // ==============================================
      // 5. 重置密码
      // ==============================================
      if (url.pathname === "/api/reset" && method === "POST") {
        const { username, newPassword, confirmPassword } = await request.json();

        if (newPassword !== confirmPassword) {
          return Response.json({ ok: false, msg: "两次密码不一致" });
        }

        await env.DB.prepare("UPDATE users SET password=? WHERE username=?")
          .bind(newPassword, username).run();

        return Response.json({ ok: true, msg: "密码重置成功！" });
      }

      // ==============================================
      // 6. 获取用户信息（金币）
      // ==============================================
      if (url.pathname === "/api/userinfo" && method === "POST") {
        const { username } = await request.json();
        const user = await env.DB.prepare("SELECT username, coins FROM users WHERE username=?")
          .bind(username).first();
        return Response.json({ ok: true, user });
      }

      // ==============================================
      // 7. 每日签到 +1 金币
      // ==============================================
      if (url.pathname === "/api/sign" && method === "POST") {
        const { username } = await request.json();
        const today = new Date().toISOString().split("T")[0];

        // 检查今天是否已签到
        const signed = await env.DB.prepare(
          "SELECT * FROM sign_in WHERE username=? AND date=?"
        ).bind(username, today).first();

        if (signed) {
          return Response.json({ ok: false, msg: "今天已经签到过啦！" });
        }

        // 插入签到记录
        await env.DB.prepare(
          "INSERT INTO sign_in (username, date) VALUES (?,?)"
        ).bind(username, today).run();

        // 金币 +1
        await env.DB.prepare(
          "UPDATE users SET coins = coins + 1 WHERE username=?"
        ).bind(username).run();

        // 获取最新金币
        const user = await env.DB.prepare("SELECT coins FROM users WHERE username=?")
          .bind(username).first();

        return Response.json({
          ok: true,
          msg: "签到成功！+1 金币",
          coins: user.coins
        });
      }

      return env.ASSETS.fetch(request);
    } catch (e) {
      return Response.json({ ok: false, error: e.message });
    }
  }
};