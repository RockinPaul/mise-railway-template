# Persistent mise Railway workspace

Thin SSH-first personal workspace: one Linux/amd64 service, one persistent `/root` volume, no public ports or SSH daemon. Root is the trusted workspace owner inside the container, not on Railway's host. Never claim whole-OS or process persistence.

Use `apply_patch` for edits. Prefix interactive shell commands with `rtk`; use context-mode for processing large output. Do not print credentials. Portable test subprocesses may invoke Docker directly.

Use Node's built-in test runner and real Docker checks. Preserve user files/tool versions on restart. Bootstrap may copy verified image assets but must never execute config, hooks, shell profiles, or binaries from the volume. Keep startup utilities on a trusted PATH. Do not recursively chown/remove a home or workspace. No destructive recovery.

Require independent spec/security review before code commits. Deployment and publication use Railway CLI/API, not browser automation. After project creation, verify the exact project ID before provisioning a template; abort after any failed init. Clean up only task-owned test resources.

