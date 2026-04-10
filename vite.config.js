import { defineConfig } from "vite";

export default defineConfig({
  base: "./",

    server: {
        host: '0.0.0.0',// 自定义主机名
        port: 1024,// 自定义端口
        https: false,
    }
});
