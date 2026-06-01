async function ensureTaskTables(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    reward_coins INTEGER,
    active INTEGER DEFAULT 1,
    task_type TEXT DEFAULT 'once', -- 'daily' or 'once'
    code TEXT -- 6-digit code required to submit completion
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    task_id INTEGER,
    completed_at TEXT
  )`).run();

  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM tasks").first();
  if (count && count.count === 0) {
    await env.DB.prepare("INSERT INTO tasks (title, description, reward_coins, task_type, code) VALUES (?,?,?,?,?)").bind(
      "首次登录奖励",
      "登录后领取，可获得金币奖励。",
      5,
      "once",
      "100001"
    ).run();
    await env.DB.prepare("INSERT INTO tasks (title, description, reward_coins, task_type, code) VALUES (?,?,?,?,?)").bind(
      "发送一条留言",
      "在留言板发送一条留言，获得额外金币奖励。",
      3,
      "daily",
      "200002"
    ).run();
    await env.DB.prepare("INSERT INTO tasks (title, description, reward_coins, task_type, code) VALUES (?,?,?,?,?)").bind(
      "首次购买",
      "购买任意商品后可领取奖励金币。",
      4,
      "once",
      "300003"
    ).run();
  }
}

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
        const existsUsername = await env.DB.prepare("SELECT username FROM users WHERE username = ?").bind(username).first();
        if (existsUsername) return Response.json({ ok: false, msg: "用户名已存在" });
        const existsEmail = await env.DB.prepare("SELECT email FROM users WHERE email = ?").bind(email).first();
        if (existsEmail) return Response.json({ ok: false, msg: "邮箱已存在" });
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

      // 用户信息（金币 + 邮箱 + 已购类型）
      if (url.pathname === "/api/userinfo" && method === "POST") {
        const { username } = await request.json();
        const user = await env.DB.prepare("SELECT username, email, coins FROM users WHERE username=?").bind(username).first();
        const items = await env.DB.prepare("SELECT item_id, type FROM user_items WHERE username=?").bind(username).all();
        // 返回已购买数组，包含 item_id 与 type
        const bought = items.results.map(i => ({ item_id: i.item_id, type: i.type }));
        return Response.json({ ok: true, user, bought });
      }

      // 发送留言
      if (url.pathname === "/api/message" && method === "POST") {
        const { username, email, text, time } = await request.json();
        if (!username || !email || !text || !time) return Response.json({ ok: false, msg: "请填写完整留言信息" });
        await env.DB.prepare("INSERT INTO message (username, email, text, time) VALUES (?,?,?,?)").bind(username, email, text, time).run();
        return Response.json({ ok: true, msg: "留言已发送" });
      }

      // 签到
      if (url.pathname === "/api/sign" && method === "POST") {
        const { username } = await request.json();
        const today = new Date().toISOString().split("T")[0];
        const signed = await env.DB.prepare("SELECT * FROM sign_in WHERE username=? AND date=?").bind(username, today).first();
        if (signed) return Response.json({ ok: false, msg: "今天已签到" });
        await env.DB.prepare("INSERT INTO sign_in (username, date) VALUES (?,?)").bind(username, today).run();
        await env.DB.prepare("UPDATE users SET coins=coins+2 WHERE username=?").bind(username).run();
        const u = await env.DB.prepare("SELECT coins FROM users WHERE username=?").bind(username).first();
        return Response.json({ ok: true, msg: "签到成功 +1金币", coins: u.coins });
      }

      // 任务功能
      if (url.pathname === "/api/tasks" && method === "GET") {
        await ensureTaskTables(env);
        const username = url.searchParams.get("username");
        const tasksResult = await env.DB.prepare("SELECT id, title, description, reward_coins, task_type, code FROM tasks WHERE active=1").all();
        let tasks = tasksResult.results || [];
        if (username) {
          const completedRows = await env.DB.prepare("SELECT task_id, completed_at FROM user_tasks WHERE username=?").bind(username).all();
          const completed = (completedRows.results || []);
          const today = new Date().toISOString().split('T')[0];
          tasks = tasks.map(task => {
            // find any completion records for this task
            const records = completed.filter(r => r.task_id == task.id);
            let completedToday = false;
            let completedEver = false;
            
            if (records && records.length > 0) {
              completedEver = true;
              completedToday = records.some(r => {
                try { return r.completed_at.split('T')[0] === today; } catch (e) { return false; }
              });
            }
            
            return {
              ...task,
              completed_today: completedToday,
              completed_ever: completedEver,
              is_available: (task.task_type || 'once') === 'daily' ? !completedToday : !completedEver
            };
          });
        }
        return Response.json({ ok: true, tasks });
      }

      if (url.pathname === "/api/task/complete" && method === "POST") {
        await ensureTaskTables(env);
        const { username, task_id, code } = await request.json();
        if (!username || !task_id || !code) return Response.json({ ok: false, msg: "参数错误，需提供 username, task_id, code" });
        const user = await env.DB.prepare("SELECT coins FROM users WHERE username=?").bind(username).first();
        const task = await env.DB.prepare("SELECT id, reward_coins, task_type, code FROM tasks WHERE id=? AND active=1").bind(task_id).first();
        if (!user || !task) return Response.json({ ok: false, msg: "用户或任务不存在" });
        // verify code
        if (!task.code || task.code.toString().trim() !== code.toString().trim()) return Response.json({ ok: false, msg: "验证码错误" });

        const today = new Date().toISOString().split('T')[0];
        if ((task.task_type || 'once') === 'daily') {
          const doneToday = await env.DB.prepare("SELECT * FROM user_tasks WHERE username=? AND task_id=?").bind(username, task_id).all();
          const records = (doneToday.results || []);
          const already = records.some(r => {
            try { return r.completed_at.split('T')[0] === today; } catch (e) { return false; }
          });
          if (already) return Response.json({ ok: false, msg: "今日任务已完成" });
          await env.DB.prepare("INSERT INTO user_tasks (username, task_id, completed_at) VALUES (?,?,?)").bind(username, task_id, new Date().toISOString()).run();
        } else {
          const completed = await env.DB.prepare("SELECT * FROM user_tasks WHERE username=? AND task_id=?").bind(username, task_id).first();
          if (completed) return Response.json({ ok: false, msg: "该任务已完成" });
          await env.DB.prepare("INSERT INTO user_tasks (username, task_id, completed_at) VALUES (?,?,?)").bind(username, task_id, new Date().toISOString()).run();
        }

        await env.DB.prepare("UPDATE users SET coins=coins+? WHERE username=?").bind(task.reward_coins, username).run();
        const u = await env.DB.prepare("SELECT coins FROM users WHERE username=?").bind(username).first();
        return Response.json({ ok: true, msg: `任务完成 +${task.reward_coins}金币`, coins: u.coins });
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