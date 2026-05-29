export default {
  async fetch(request, env) {
    try {
      // 测试 D1 连接
      const { results } = await env.DB.prepare("SELECT 1 as test").all();
      return new Response(JSON.stringify({
        ok: true,
        message: "D1 连接成功！",
        test_result: results[0].test
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      // 把错误详情返回给你看
      return new Response(JSON.stringify({
        ok: false,
        error: err.message,
        stack: err.stack
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};