/*
 * AI 解锁检测 · Loon 通用脚本
 * 作者：Cooper（为 ben 编写），2026-11-26
 *
 * 用法（在 iPhone 的 Loon 里）：
 *   1. Loon → 配置 → 脚本 → 右上角 + → 新建本地脚本
 *   2. 把本文件内容全部粘贴进去，类型选「通用」，保存
 *   3. 在「所有节点」页面长按任意节点 → 选择本脚本运行
 *   4. 几秒后弹出检测结果
 *
 * 检测内容（只测网页能不能打开，不测账号登录）：
 *   ChatGPT / Claude / Gemini / Grok / Perplexity / Copilot
 *
 * 判断方法：
 *   ChatGPT：请求 chat.openai.com/cdn-cgi/trace，能返回 loc= 地区即支持
 *   Claude：请求 claude.ai，200 且页面无地区限制提示即支持；
 *           403 且是 Cloudflare 验证页 = 机房 IP 被拦截；
 *           页面含 not available = 该地区不支持
 *   Gemini：用一个无效 key 请求 Generative Language API，
 *           返回 400 "API key not valid" 说明该地区可用；
 *           返回 403 "location is not supported" 说明该地区不支持
 *   Grok / Perplexity：首页 200 即支持
 *   Copilot：首页 200 / 301 / 302 即支持（会跳转到登录页是正常的）
 *
 * 注意：这只能说明「这个节点能不能打开 AI 网站」。
 * Claude 对机房 IP 特别严，即使页面能打开，登录时也可能再被拦；
 * 反过来，页面打不开就肯定用不了。
 */

var UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
var TIMEOUT = 6000;

var nodeName = '当前节点';
try {
  if ($environment && $environment.params && $environment.params.node) {
    nodeName = $environment.params.node;
  }
} catch (e) {}

// 不支持 ChatGPT 的地区（OpenAI 官方不支持的地区）
var GPT_BLOCKED_REGIONS = ['CN', 'RU', 'IR', 'KP', 'SY', 'CU', 'AF', 'BY', 'MM', 'VE'];

// 简单的地区代码 → 国旗
var FLAGS = {
  'US': '🇺🇸', 'HK': '🇭🇰', 'JP': '🇯🇵', 'KR': '🇰🇷', 'SG': '🇸🇬',
  'TW': '🇹🇼', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 'NL': '🇳🇱',
  'CA': '🇨🇦', 'AU': '🇦🇺', 'IN': '🇮🇳', 'BR': '🇧🇷', 'TR': '🇹🇷',
  'AE': '🇦🇪', 'ID': '🇮🇩', 'MY': '🇲🇾', 'TH': '🇹🇭', 'VN': '🇻🇳',
  'PH': '🇵🇭', 'UA': '🇺🇦', 'PL': '🇵🇱', 'SE': '🇸🇪', 'CH': '🇨🇭'
};
function flag(code) {
  return FLAGS[code] || ('[' + code + ']');
}

// 发起一次请求，永远 resolve，不 reject
function req(url, noRedirect) {
  return new Promise(function (resolve) {
    var params = {
      url: url,
      headers: { 'User-Agent': UA },
      timeout: TIMEOUT
    };
    if (nodeName !== '当前节点') params.node = nodeName;
    if (noRedirect) params['auto-redirect'] = false;
    $httpClient.get(params, function (error, response, data) {
      if (error) {
        resolve({ ok: false, error: String(error) });
        return;
      }
      var status = (response && (response.statusCode || response.status)) || 0;
      var headers = (response && response.headers) || {};
      resolve({ ok: true, status: status, headers: headers, body: data || '' });
    });
  });
}

function line(name, icon, text) {
  return '<b>' + name + '：</b>' + icon + ' ' + text;
}

// ---- ChatGPT ----
function testChatGPT() {
  return req('https://chat.openai.com/cdn-cgi/trace').then(function (r) {
    if (!r.ok) return line('ChatGPT', '❌', '无法连接');
    if (r.status === 403) return line('ChatGPT', '❌', '被 Cloudflare 拦截');
    if (r.status !== 200) return line('ChatGPT', '❗️', '检测失败（HTTP ' + r.status + '）');
    var m = r.body.match(/loc=([A-Z]{2})/);
    var loc = m ? m[1] : '??';
    if (GPT_BLOCKED_REGIONS.indexOf(loc) !== -1) {
      return line('ChatGPT', '❌', '地区不支持 ' + flag(loc) + ' ' + loc);
    }
    return line('ChatGPT', '✅', '支持 ' + flag(loc) + ' ' + loc);
  });
}

// ---- Claude ----
function testClaude() {
  return req('https://claude.ai/', true).then(function (r) {
    if (!r.ok) return line('Claude', '❌', '无法连接');
    var body = (r.body || '').toLowerCase();
    if (body.indexOf('not available') !== -1 || body.indexOf("isn't available") !== -1 || body.indexOf('unavailable in your region') !== -1) {
      return line('Claude', '❌', '地区不支持');
    }
    if (r.status === 403) {
      if (body.indexOf('just a moment') !== -1 || body.indexOf('cloudflare') !== -1) {
        return line('Claude', '❌', '被 Cloudflare 拦截（机房 IP 常被拦）');
      }
      return line('Claude', '❌', '被拒绝（HTTP 403）');
    }
    if (r.status === 200 || r.status === 301 || r.status === 302) {
      return line('Claude', '✅', '支持');
    }
    return line('Claude', '❗️', '检测失败（HTTP ' + r.status + '）');
  });
}

// ---- Gemini ----
function testGemini() {
  // 用无效 key 探路：地区可用返回 400 API key not valid；
  // 地区不支持返回 403 location is not supported
  return req('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyFakeKeyForDetectionOnly').then(function (r) {
    if (!r.ok) return line('Gemini', '❌', '无法连接');
    var body = r.body || '';
    if (r.status === 400 && body.indexOf('API key not valid') !== -1) {
      return line('Gemini', '✅', '支持');
    }
    if (body.indexOf('location is not supported') !== -1 || body.indexOf('User location is not supported') !== -1) {
      return line('Gemini', '❌', '地区不支持');
    }
    if (r.status === 403) return line('Gemini', '❌', '被拒绝（HTTP 403）');
    if (r.status === 400) return line('Gemini', '✅', '支持');
    return line('Gemini', '❗️', '检测失败（HTTP ' + r.status + '）');
  });
}

// ---- Grok ----
function testGrok() {
  return req('https://grok.com/', true).then(function (r) {
    if (!r.ok) return line('Grok', '❌', '无法连接');
    if (r.status === 200 || r.status === 301 || r.status === 302) return line('Grok', '✅', '支持');
    if (r.status === 403) return line('Grok', '❌', '被拦截（HTTP 403）');
    return line('Grok', '❗️', '检测失败（HTTP ' + r.status + '）');
  });
}

// ---- Perplexity ----
function testPerplexity() {
  return req('https://www.perplexity.ai/', true).then(function (r) {
    if (!r.ok) return line('Perplexity', '❌', '无法连接');
    if (r.status === 200 || r.status === 301 || r.status === 302) return line('Perplexity', '✅', '支持');
    if (r.status === 403) return line('Perplexity', '❌', '被拦截（HTTP 403）');
    return line('Perplexity', '❗️', '检测失败（HTTP ' + r.status + '）');
  });
}

// ---- Copilot ----
function testCopilot() {
  return req('https://copilot.microsoft.com/', true).then(function (r) {
    if (!r.ok) return line('Copilot', '❌', '无法连接');
    if (r.status === 200 || r.status === 301 || r.status === 302) return line('Copilot', '✅', '支持');
    if (r.status === 403) return line('Copilot', '❌', '被拦截（HTTP 403）');
    return line('Copilot', '❗️', '检测失败（HTTP ' + r.status + '）');
  });
}

Promise.all([
  testChatGPT(),
  testClaude(),
  testGemini(),
  testGrok(),
  testPerplexity(),
  testCopilot()
]).then(function (results) {
  var okCount = 0;
  results.forEach(function (s) { if (s.indexOf('✅') !== -1) okCount++; });
  var content = '------------------------------------</br>'
    + results.join('</br></br>')
    + '</br>------------------------------------</br>'
    + '支持 ' + okCount + ' / 6 个 AI 服务</br>'
    + '<font color=#CD5C5C><b>节点</b> ➟ ' + nodeName + '</font>';
  content = '<p style="text-align: center; font-family: -apple-system; font-size: large;">' + content + '</p>';
  $done({ title: 'AI 解锁检测', htmlMessage: content });
}).catch(function (e) {
  $done({ title: 'AI 解锁检测', htmlMessage: '检测出错：' + e });
});
