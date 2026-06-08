const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const splashPath = path.join(__dirname, '../../desktop/windows/resources/splash.html');

test('desktop splash shows startup status rows without removed copy', () => {
  const html = fs.readFileSync(splashPath, 'utf8');

  assert.match(html, /启动中/);
  assert.match(html, /已启动/);
  assert.match(html, /正在启动/);
  assert.match(html, /尚未启动/);
  assert.doesNotMatch(html, /正在启动本地服务/);
  assert.doesNotMatch(html, /企业级RAG知识库平台/);
  assert.doesNotMatch(html, /总计划/);
});
