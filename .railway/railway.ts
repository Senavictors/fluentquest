import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

export default defineRailway(() => {
  const db = postgres("fluentquest-postgres");
  const files = volume("fluentquest-files", { sizeMB: 1024 });

  const app = service("fluentquest-app", {
    source: github("Senavictors/FluentQuest", { branch: "main" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    start: "npm run start:railway",
    preDeploy: "npm run db:migrate:railway",
    healthcheck: "/",
    healthcheckTimeout: 60,
    replicas: 1,
    volumeMounts: { "/app/data": files },
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: preserve(),
      AI_ENABLED: "false",
      DATA_DIR: "/app/data",
      NODE_ENV: "production",
    },
  });

  return project("FluentQuest", { resources: [db, files, app] });
});
