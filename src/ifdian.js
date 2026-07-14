import crypto from 'node:crypto';

/**
 * 生成爱发电 API 签名
 * sign = md5(token + params{params值} + ts{ts值} + user_id{user_id值})
 */
export function signRequest(token, user_id, params, ts) {
  const raw = `${token}params${params}ts${ts}user_id${user_id}`;
  return crypto.createHash('md5').update(raw, 'utf-8').digest('hex');
}

/**
 * 查询订单是否存在
 * @param {string} user_id - 爱发电开发者后台的 user_id
 * @param {string} token - 爱发电开发者后台的 api token
 * @param {string} out_trade_no - 要查询的订单号
 * @returns {Promise<{exists: boolean, order?: object, raw?: object}>}
 */
export async function queryOrder(user_id, token, out_trade_no) {
  const params = JSON.stringify({ out_trade_no });
  const ts = Math.floor(Date.now() / 1000);
  const sign = signRequest(token, user_id, params, ts);

  const body = { user_id, params, ts, sign };

  const resp = await fetch('https://ifdian.net/api/open/query-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  const result = await resp.json();

  if (result.ec !== 200) {
    throw new Error(`API 错误 (${result.ec}): ${result.em}${result.data?.debug ? ' (签名调试: ' + JSON.stringify(result.data.debug) + ')' : ''}`);
  }

  const list = result.data?.list ?? [];
  const order = list.length > 0 ? list[0] : null;

  return {
    exists: order !== null,
    order,
    raw: result,
  };
}

/**
 * 批量查询多个订单号是否存在（每个单独请求）
 */
export async function queryOrders(user_id, token, orderNumbers) {
  const results = {};
  for (const no of orderNumbers) {
    results[no] = await queryOrder(user_id, token, no);
  }
  return results;
}

/**
 * 按页查询订单（用于拉取历史订单列表）
 * @param {string} user_id
 * @param {string} token
 * @param {number} page - 页码，从 1 开始
 * @returns {Promise<{list: object[], total_count: number, total_page: number}>}
 */
export async function queryOrdersByPage(user_id, token, page = 1) {
  const params = JSON.stringify({ page });
  const ts = Math.floor(Date.now() / 1000);
  const sign = signRequest(token, user_id, params, ts);

  const body = { user_id, params, ts, sign };

  const resp = await fetch('https://ifdian.net/api/open/query-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }

  const result = await resp.json();

  if (result.ec !== 200) {
    throw new Error(`API 错误 (${result.ec}): ${result.em}${result.data?.debug ? ' (签名调试: ' + JSON.stringify(result.data.debug) + ')' : ''}`);
  }

  return result.data ?? { list: [], total_count: 0, total_page: 0 };
}

/**
 * 拉取所有历史订单号（遍历所有页）
 * @param {string} user_id
 * @param {string} token
 * @returns {Promise<string[]>} 所有历史订单号列表
 */
export async function fetchAllOrderNumbers(user_id, token) {
  const allOrders = [];
  let page = 1;
  let totalPage = 1;

  while (page <= totalPage) {
    const data = await queryOrdersByPage(user_id, token, page);
    totalPage = data.total_page || 0;
    if (data.list && data.list.length > 0) {
      for (const order of data.list) {
        if (order.out_trade_no) {
          allOrders.push(order.out_trade_no);
        }
      }
    }
    page++;
    // 避免无限循环，最多拉 100 页
    if (page > 100) break;
  }

  return allOrders;
}