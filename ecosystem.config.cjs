module.exports = {
  apps: [
    {
      name: "opo-server",
      script: "./packages/server/dist/index.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/server-error.log",
      out_file: "./logs/server-out.log",
      log_file: "./logs/server-combined.log",
      time: true,
    },
    {
      name: "opo-worker",
      script: "./packages/server/dist/jobs/worker.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/worker-error.log",
      out_file: "./logs/worker-out.log",
      log_file: "./logs/worker-combined.log",
      time: true,
    },
  ],
};
