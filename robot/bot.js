#!/usr/bin/env node
import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { queryOrder, fetchAllOrderNumbers } from '../cli/ifdian.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, '..', 'history.json');

// ============ 配置加载 ============
let config;
try {
  const cfgPath = path.join(__dirname, '..', 'config.json');
  if (!fs.existsSync(cfgPath)) {
    console.error('错误: 未找到 config.json');
    console.error('请复制 config.example.json 为 config.json 并填写配置');
    process.exit(1);
  }
  config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
} catch (err) {
  console.error('错误: 配置文件读取失败:', err.message);
  process.exit(1);
}

const IFDIAN_USER_ID = config.ifdian?.user_id;
const IFDIAN_TOKEN = config.ifdian?.token;
const WS_URL = config.napcat?.wsUrl || 'ws://localhost:3001';

if (!IFDIAN_USER_ID || !IFDIAN_TOKEN) {
  console.error('错误: ifdian.user_id 和 ifdian.token 必须填写');
  process.exit(1);
}

// ============ 审批历史管理 ============
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    console.warn('警告: history.json 解析失败，将重置');
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

function isUserInHistory(userId) {
  return loadHistory().some(e => e.userId === userId);
}

function isOrderInHistory(orderNo) {
  if (!orderNo) return false;
  return loadHistory().some(e => e.orderNo === orderNo);
}

function addHistory(action, userId, orderNo, comment) {
  const history = loadHistory();
  history.push({
    orderNo: orderNo || '',
    userId,
    comment: comment || '',
    timestamp: Date.now(),
    action
  });
  saveHistory(history);
}

// ============ NapCat WebSocket ============
let ws = null;
let echoCounter = 0;
const pendingEcho = new Map();

function sendApi(action, params) {
  return new Promise((resolve, reject) => {
    const echo = `echo_${++echoCounter}`;
    const msg = JSON.stringify({ action, params, echo });

    const timer = setTimeout(() => {
      pendingEcho.delete(echo);
      reject(new Error(`API 调用超时: ${action}`));
    }, 10000);

    pendingEcho.set(echo, (data) => {
      clearTimeout(timer);
      resolve(data);
    });

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    } else {
      clearTimeout(timer);
      pendingEcho.delete(echo);
      reject(new Error('WebSocket 未连接'));
    }
  });
}

function connect() {
  console.log(`正在连接 NapCat WebSocket: ${WS_URL} ...`);

  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('✓ 已连接到 NapCat，开始监听加群请求...');
    console.log(`  目标群号: ${targetGroupId}`);
    console.log('  等待事件中...\n');
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      // API 调用响应
      if (msg.echo && pendingEcho.has(msg.echo)) {
        const cb = pendingEcho.get(msg.echo);
        pendingEcho.delete(msg.echo);
        cb(msg);
        return;
      }

      // 加群请求事件
      if (msg.post_type === 'request' && msg.request_type === 'group') {
        handleGroupRequest(msg).catch(err =>
          console.error('处理加群请求时发生未捕获错误:', err)
        );
      }
    } catch (err) {
      console.error('消息解析错误:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('⚠ WebSocket 连接断开，5 秒后重连...');
    setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    console.error('WebSocket 连接错误:', err.message);
    ws.close();
  });
}

// ============ 加群请求处理 ============
async function handleGroupRequest(event) {
  const { group_id, user_id, comment, flag, sub_type } = event;

  const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  console.log(`[${ts}] 收到加群请求`);
  console.log(`  用户: ${user_id} | 群: ${group_id} | 留言: "${comment || ''}"`);

  // 只处理目标群
  if (group_id !== targetGroupId) {
    console.log(`  → 跳过 (非目标群)`);
    return;
  }

  // 该用户已有审批记录 → 忽略，等人工处理
  if (isUserInHistory(user_id)) {
    console.log(`  → 忽略: 用户 ${user_id} 已有审批记录，等待人工处理`);
    addHistory('ignored_manual', user_id, '', comment);
    return;
  }

  // 从留言中提取订单号——取第一串连续数字（至少10位）
  const rawComment = (comment || '').trim();
  console.log(`  原始留言: "${rawComment}" (长度: ${rawComment.length}, 字符码: ${[...rawComment].map(c => c.charCodeAt(0)).join(',')})`);
  const match = rawComment.match(/(\d{10,})/);
  const orderNo = match ? match[1] : rawComment;
  if (match) {
    console.log(`  从留言中提取到订单号: ${orderNo}`);
  } else {
    console.log(`  原始留言中未找到数字串，整体作为订单号: ${orderNo}`);
  }
  if (!orderNo) {
    console.log(`  → 拒绝: 未填写订单号`);
    await doReject(flag, sub_type || 'add', '请填写爱发电订单号作为加群验证');
    addHistory('rejected_noid', user_id, '', comment);
    return;
  }

  // 查询爱发电订单
  try {
    console.log(`  → 查询订单: ${orderNo}`);
    const result = await queryOrder(IFDIAN_USER_ID, IFDIAN_TOKEN, orderNo);

    // 打印完整 API 响应以便排查
    console.log(`  → API 响应 ec=${result.raw?.ec}, list=${result.raw?.data?.list?.length ?? 0} 条`);
    if (!result.exists && result.raw) {
      console.log(`  → DEBUG 原始响应: ${JSON.stringify(result.raw).substring(0, 1000)}`);
    }

    if (result.exists) {
      if (isOrderInHistory(orderNo)) {
        // 单号存在但已被使用
        console.log(`  → 拒绝: 单号 ${orderNo} 已被使用过`);
        await doReject(flag, sub_type || 'add', `订单号 ${orderNo} 已经被使用过`);
        addHistory('rejected_used', user_id, orderNo, comment);
      } else {
        // 单号存在且未被使用 → 通过
        console.log(`  → 通过: 单号 ${orderNo} 有效`);
        await doApprove(flag, sub_type || 'add');
        addHistory('approved', user_id, orderNo, comment);
      }
    } else {
      // 单号不存在
      console.log(`  → 拒绝: 单号 ${orderNo} 不存在`);
      await doReject(flag, sub_type || 'add', `订单号 ${orderNo} 不存在`);
      addHistory('rejected_notfound', user_id, orderNo, comment);
    }
  } catch (err) {
    console.error(`  → 错误: 查询订单 ${orderNo} 失败: ${err.message}`);
    await doReject(flag, sub_type || 'add', '订单验证失败，请稍后重试');
    addHistory('error', user_id, orderNo, comment);
  }
}

async function doApprove(flag, subType) {
  try {
    const res = await sendApi('set_group_add_request', {
      flag,
      type: subType,
      approve: true,
    });
    if (res.status === 'ok') {
      console.log('  ✓ 已批准入群');
    } else {
      console.error('  ✗ 批准失败:', JSON.stringify(res));
    }
  } catch (err) {
    console.error('  ✗ 批准请求发送失败:', err.message);
  }
}

async function doReject(flag, subType, reason) {
  try {
    const res = await sendApi('set_group_add_request', {
      flag,
      type: subType,
      approve: false,
      reason,
    });
    if (res.status === 'ok') {
      console.log(`  ✓ 已拒绝, 原因: ${reason}`);
    } else {
      console.error('  ✗ 拒绝失败:', JSON.stringify(res));
    }
  } catch (err) {
    console.error('  ✗ 拒绝请求发送失败:', err.message);
  }
}

// ============ 启动 ============
let targetGroupId = 0;

function start(gid) {
  targetGroupId = gid;
  console.log(`>> 爱发电赞助者群自动审批机器人 <<`);
  console.log(`目标群号: ${targetGroupId}\n`);

  // 确保历史文件存在，不存在则从爱发电拉取所有历史订单
  if (!fs.existsSync(HISTORY_FILE)) {
    console.log('history.json 不存在，正在从爱发电拉取所有历史订单号...');
    fetchAllOrderNumbers(IFDIAN_USER_ID, IFDIAN_TOKEN)
      .then(orderNumbers => {
        const history = orderNumbers.map(no => ({
          orderNo: no,
          userId: null,
          comment: null,
          timestamp: Date.now(),
          action: 'preloaded'
        }));
        saveHistory(history);
        console.log(`✓ 已从爱发电拉取 ${orderNumbers.length} 条历史订单，写入 history.json`);
        console.log('开始监听加群请求...\n');
      })
      .catch(err => {
        console.error('拉取历史订单失败:', err.message);
        console.log('将使用空历史记录启动');
        saveHistory([]);
        console.log('开始监听加群请求...\n');
      });
  } else {
    const h = loadHistory();
    console.log(`已加载 history.json，共 ${h.length} 条记录`);
    console.log('开始监听加群请求...\n');
  }

  connect();
}

function getGroupIdFromArgs() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const n = parseInt(args[0], 10);
    if (!isNaN(n)) return n;
  }
  return null;
}

// 入口：优先命令行参数，否则交互输入
const gid = getGroupIdFromArgs();
if (gid) {
  start(gid);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('请输入需要自动审批的群号: ', (answer) => {
    rl.close();
    const n = parseInt(answer.trim(), 10);
    if (isNaN(n)) {
      console.error('错误: 群号必须为数字');
      process.exit(1);
    }
    start(n);
  });
}

