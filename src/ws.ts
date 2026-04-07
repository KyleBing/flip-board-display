export function createOkxWsClient({ onStatus, onTicker, reconnectDelayMs = 2000 }) {
  let socket = null;
  let reconnectTimer = null;
  let manualStop = false;
  let subscribedSymbols = [];

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const parseSymbols = (symbolsInput) => {
    if (Array.isArray(symbolsInput)) {
      return symbolsInput.map((item) => String(item ?? "").trim().toUpperCase()).filter(Boolean);
    }
    return String(symbolsInput ?? "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  };

  const subscribeTickers = async () => {
    const symbols = subscribedSymbols;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    if (symbols.length === 0) {
      onStatus("已连接：OKX（无可订阅币对）");
      return;
    }

    const batchSize = 100;
    for (let i = 0; i < symbols.length; i += batchSize) {
      socket.send(
        JSON.stringify({
          op: "subscribe",
          args: symbols.slice(i, i + batchSize).map((instId) => ({ channel: "tickers", instId })),
        }),
      );
    }
    onStatus(`已连接：OKX（已订阅前 ${symbols.length} 个常用币对）`);
  };

  const connect = (symbolsInput) => {
    subscribedSymbols = parseSymbols(symbolsInput);
    manualStop = false;
    clearReconnectTimer();
    if (socket) {
      socket.close();
      socket = null;
    }

    try {
      socket = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");
    } catch {
      onStatus("连接失败");
      return;
    }

    onStatus("连接中...");

    socket.onopen = async () => {
      onStatus("已连接：OKX");
      await subscribeTickers();
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.arg?.channel !== "tickers" || !payload?.data?.[0]) {
          return;
        }
        const item = payload.data[0];
        onTicker({
          symbol: item.instId,
          last: item.last,
          open24h: item.open24h,
          volCcy24h: item.volCcy24h,
          vol24h: item.vol24h,
        });
      } catch {
        // ignore malformed packet
      }
    };

    socket.onclose = () => {
      socket = null;
      if (manualStop) {
        onStatus("已断开");
        return;
      }
      onStatus("重连中...");
      clearReconnectTimer();
      reconnectTimer = setTimeout(connect, reconnectDelayMs);
    };

    socket.onerror = () => {
      onStatus("连接错误");
    };
  };

  const disconnect = () => {
    manualStop = true;
    clearReconnectTimer();
    if (socket) {
      socket.close();
      socket = null;
    }
    onStatus("已停止");
  };

  return { connect, disconnect };
}
