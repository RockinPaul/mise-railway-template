import { defineRailway, github, project, service, volume } from "railway/iac";
import { preserveOwnerVariables } from "./preserve-owner-variables.mjs";

export function workspaceProject(env = {}) {
  const home = volume("workspace-home", { sizeMB: 5000 });
  const workspace = service("workspace", {
    env,
    source: github("RockinPaul/mise-railway-template", { branch: "main" }),
    build: {
      dockerfilePath: "Dockerfile",
      watchPatterns: ["/Dockerfile", "/workspace-entrypoint.sh", "/mise-launcher.sh", "/workspace-defaults/**"],
    },
    replicas: 1,
    volumeMounts: { "/root": home },
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
      sleepApplication: false,
      drainingSeconds: 10,
      requiredMountPath: "/root",
      limitOverride: { containers: { cpu: 2, memoryBytes: 2147483648 } },
    },
  });
  // The SDK's volume shorthand creates this typed attachment; add its backup policy.
  workspace.volumeAttachments![home.name].backupSchedules = ["DAILY"];
  return project("mise-railway-template", { resources: [workspace, home] });
}

export default defineRailway(ctx => workspaceProject(preserveOwnerVariables(ctx)));
