import { spawn } from "node:child_process";
import fs from "node:fs";

const postLog = (payload) =>
  fetch("http://127.0.0.1:7622/ingest/1302b181-d6d7-4b6e-bbe5-61c8fc200112", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "6b0f53",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});

const runId = process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now()}`;

// #region agent log
postLog({
  sessionId: "6b0f53",
  runId,
  hypothesisId: "H1",
  location: "scripts/vercel-build.mjs:17",
  message: "Root vercel-build script entry",
  data: {
    cwd: process.cwd(),
    hasRootAppDir: fs.existsSync("app"),
    hasRootPagesDir: fs.existsSync("pages"),
    nodeEnv: process.env.NODE_ENV || null,
  },
  timestamp: Date.now(),
});
// #endregion

const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build", "--workspace=hub"],
  { stdio: "inherit", shell: false }
);

child.on("exit", (code) => {
  const workspaceBuildDir = "apps/hub/.next";
  const rootBuildDir = ".next";

  // #region agent log
  postLog({
    sessionId: "6b0f53",
    runId,
    hypothesisId: "H6",
    location: "scripts/vercel-build.mjs:45",
    message: "Build output directories before copy",
    data: {
      code,
      workspaceBuildDirExists: fs.existsSync(workspaceBuildDir),
      rootBuildDirExists: fs.existsSync(rootBuildDir),
      workspaceRoutesManifestExists: fs.existsSync(
        `${workspaceBuildDir}/routes-manifest.json`
      ),
      rootRoutesManifestExists: fs.existsSync(`${rootBuildDir}/routes-manifest.json`),
    },
    timestamp: Date.now(),
  });
  // #endregion

  if ((code ?? 1) === 0 && fs.existsSync(workspaceBuildDir)) {
    if (fs.existsSync(rootBuildDir)) fs.rmSync(rootBuildDir, { recursive: true, force: true });
    fs.cpSync(workspaceBuildDir, rootBuildDir, { recursive: true });
  }

  // #region agent log
  postLog({
    sessionId: "6b0f53",
    runId,
    hypothesisId: "H5",
    location: "scripts/vercel-build.mjs:41",
    message: "Hub workspace build exited",
    data: {
      code,
      rootRoutesManifestExistsAfterCopy: fs.existsSync(
        `${rootBuildDir}/routes-manifest.json`
      ),
    },
    timestamp: Date.now(),
  }).finally(() => process.exit(code ?? 1));
  // #endregion
});
