# Release verification — 2026-09-09

Published template: [Persistent mise Workspace](https://railway.com/deploy/persistent-mise-workspace).

## Automated checks

- `npm run build`: real Linux/amd64 Docker image built successfully.
- `npm test`: 27 tests passed, zero failures or skipped tests; final local run took 80.1 seconds.
- GitHub Actions passed the same build/test workflow: [verification run](https://github.com/RockinPaul/mise-railway-template/actions/runs/34347169363).
- Independent bootstrap and whole-branch reviews passed after correcting a test assertion and native IaC variable preservation.
- Shell syntax and Git whitespace checks passed; dependency audit reported zero vulnerabilities.

Docker checks covered empty-volume initialization without networking, exact starter versions, existing-user-data preservation, interrupted setup, missing/read-only volumes, unsafe paths and symlinks, malicious startup content, interactive/one-shot commands, extra-tool and virtual-environment persistence across offline replacement, project-config trust and changed-config reapproval, regenerated shim protection, tmux behavior, and graceful shutdown.

The mise CI auto-approval regression is covered by tests and the documented launcher guard. The native Railway helper was checked against malformed/inaccessible state and sealed variables; a real preview and apply preserved a preexisting owner variable without copying its value into the authoring graph.

## Actual Railway deployment

A reference project was deployed from the repository using native CLI/IaC. Managed SSH confirmed root UID 0 and `/root` as home, with Node 24.21.0, Python 3.13.15, and uv 0.12.11 available. Interactive Bash and one-shot commands both worked.

A project sentinel, Python virtual environment, and separately installed uv 0.12.10 survived a real Railway redeploy. A `/tmp` sentinel and tmux session did not survive replacement, confirming the documented boundary between persistent files and ephemeral container/process state.

## Fresh published-template copy

A separate empty project was provisioned using the actual published template. Its volume did not contain the reference project's test files. Readback verified:

- One private service, no public domains, one replica, sleeping disabled.
- CPU limit 2 vCPU and memory limit 2147483648 bytes.
- One volume mounted at `/root`, explicitly sized to 5000 MB.
- A daily backup schedule created automatically for the fresh copy.
- No required application variables or embedded credentials.

The fresh copy passed managed SSH, baseline-tool checks, additional uv installation, and project/virtual-environment/tool persistence across its own redeployment.

## Backup restore proof

A manual snapshot was taken after syncing the disposable workspace. Its test file was then changed and uv 0.12.10 explicitly uninstalled. The restore API completed and created a new detached volume. After explicitly attaching that restored volume at `/root` and waiting for the replacement deployment, verification recovered the original file contents, executed the existing virtual environment, and successfully ran the previously deleted uv 0.12.10 installation. No reinstall command was used during recovery verification.

The original volume was retained until recovery checks passed. The disposable project and both test volumes were then deleted; do not rely on recovering that test data. The reference workspace and its daily-backed-up volume were retained.

## Platform observations for maintainers

- The template generator omitted CPU/memory caps, sleeping/replica settings, volume size, and backup scheduling. These were set explicitly in the published template and checked on its fresh deployment. Keep those readback checks when updating the template.
- Initial native IaC volume creation did not establish the intended daily schedule in this CLI/platform version. The reference schedule was explicitly enabled through the public backup API. The published template's explicit `backupSchedules` setting did establish it automatically on the fresh copy.
- The running manifest did not expose `requiredMountPath`; the entrypoint's real mount and writability checks enforce the required persistent home before becoming ready.
- Template provisioning, volume attachment, and managed SSH availability can lag the API/CLI success response. Poll actual resource state and test connectivity; do not repeat mutations merely because the first readback is stale.
- Image builds and explicitly requested extra installations require networking. An extra installation encountered shared-IP GitHub API rate-limit warnings but completed using the pinned artifact. Offline startup/replacement is proven by Docker's disabled-network tests, not by a Railway-wide egress block.
