#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { queryOrder } from './ifdian.js';

function loadConfig(cfgPath) {
  const path = cfgPath || process.env.ifdian_CONFIG;
  if (path && existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf-8'));
  }
  // 也支持直接挂环境变量
  const envConfig = {
    user_id: process.env.ifdian_USER_ID,
    token: process.env.ifdian_TOKEN,
  };
  if (envConfig.user_id && envConfig.token) return envConfig;
  // 尝试默认路径
  for (const p of ['./config.json', './ifdian-config.json']) {
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'));
  }
  return null;
}

function printHelp() {
  console.log(`
  爱发电订单号查询工具

  用法:
    node cli.js <订单号> [-c <配置文件路径>]
    node cli.js <订单号1> <订单号2> ... [-c <配置文件路径>]

  环境变量:
    ifdian_USER_ID      爱发电开发者 user_id
    ifdian_TOKEN        爱发电开发者 api token
    ifdian_CONFIG       配置文件路径

  配置文件示例 (config.json):
    {
      "user_id": "你的 user_id",
      "token": "你的 api token"
    }

  注意: user_id 和 token 可在 https://ifdian.net/dashboard/dev 获取
  `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // 提取 -c 参数
  let cfgPath = null;
  const orderNumbers = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-c' && i + 1 < args.length) {
      cfgPath = args[++i];
    } else {
      orderNumbers.push(args[i]);
    }
  }

  const config = loadConfig(cfgPath);
  if (!config || !config.user_id || !config.token) {
    console.error('错误: 未找到配置。请通过 -c 指定配置文件, 或设置 ifdian_USER_ID / ifdian_TOKEN 环境变量。');
    printHelp();
    process.exit(1);
  }

  for (const orderNo of orderNumbers) {
    try {
      const result = await queryOrder(config.user_id, config.token, orderNo);
      if (result.exists) {
        console.log(`✓ 订单 ${orderNo} 存在`);
        console.log(`  金额: ${result.order.show_amount} | 状态: ${result.order.status} | 用户: ${result.order.user_id}`);
      } else {
        console.log(`✗ 订单 ${orderNo} 不存在`);
      }
    } catch (err) {
      console.error(`✗ 订单 ${orderNo} 查询失败: ${err.message}`);
    }
  }
}

main();
