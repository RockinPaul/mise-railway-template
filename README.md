[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/persistent-mise-workspace?referralCode=YqmMB-&utm_medium=integration&utm_source=template&utm_campaign=generic)

# Persistent mise Workspace on Railway

A private Debian Linux workspace with persistent projects, shell settings, and developer runtimes. Connect through Railway's managed SSH; there is no public terminal, browser IDE, or SSH server to secure.

## Included

- Debian 13 slim (Linux/amd64), mise 2026.10.11, Node 24.21.0, Python 3.13.15, and uv 0.12.11.
- Bash, Git, SSH client, curl, jq, ripgrep, tmux, archive utilities, and common C/C++ build dependencies.
- One persistent `/root` volume, initially 5000 MB, with daily backups.
- One always-on service, with starting limits of 2 vCPU and 2 GiB memory. These are caps, not reserved resources or a monthly price guarantee.
- No required application variables, provider API keys, public domains, or TCP proxies.

## Connect

Deploy the template, wait for the `workspace` service to become active, then link the Railway CLI to your project:

```sh
railway link
railway ssh --service workspace
```

Inside the workspace:

```sh
cd /root/projects
node --version
python --version
uv --version
mkdir my-project
cd my-project
python -m venv .venv
```

Use a named tmux session for work that should continue after SSH disconnects:

```sh
tmux new-session -A -s work
```

Detach with `Ctrl-b`, then `d`. Reconnect and run the same command. A redeploy or restart ends running processes and tmux sessions; storage persistence is not process persistence.

Railway also provides managed SFTP/SCP. This template does not install `sshd`, open port 22, or claim VS Code Remote-SSH support. See [Railway SSH documentation](https://docs.railway.com/cli/ssh).

## Install and select tools

The starter tools are available offline on the first boot. Additional tools require networking when you choose to install them:

```sh
mise use --global --pin bun@latest
bun --version
```

That explicit command resolves a version and records the concrete result. Restarting the service does not upgrade it. Prefer project-level configuration for repositories:

```sh
cd /root/projects/my-project
mise use --pin node@24.21.0
mise exec -- node --version
```

Review downloaded `mise.toml` files before running `mise trust`. Paranoid mode requires approval for project configurations and reapproval after changes, including in CI. It does not sandbox a configuration after you approve it. Global configuration remains trusted owner-controlled state. Do not blanket-trust `/root` or the entire projects directory.

The pinned mise release auto-approves trust when it inherits `CI=true`, even in paranoid mode. A small image-managed launcher therefore refuses mise/shim commands in that environment. Run `env -u CI mise ...` to configure tools explicitly; for a program that needs CI behavior, use `env -u CI mise exec -- env CI=true COMMAND` after reviewing and trusting its project. This guard does not silently change the environment of your programs. The raw upstream binary at `/usr/local/libexec/mise` is available for deliberate owner-controlled recovery; invoking it directly bypasses the guard.

Interactive Bash activates mise. Noninteractive commands use mise shims from `PATH`; `mise exec -- COMMAND` is the explicit option when a project also configures environment variables. Automatic installation on command lookup and `mise exec` is disabled.

## What survives a replacement?

Everything stored under `/root`, including projects, virtual environments, mise tools/plugins/shims/configuration, shell history and dotfiles, and owner-created CLI settings, remains on the volume. The seed currently occupies roughly 360 MB before your projects and caches.

The operating system, `/usr/local/bin/mise`, and other image-managed files do not live on the volume. Manual `apt install` changes outside `/root` disappear on replacement. Add permanent OS packages to the Dockerfile in your fork. Running commands, in-memory state, tmux sessions, and files outside `/root` are not preserved.

This is a personal workspace for a trusted operator with root inside the container—not root on Railway's host and not an untrusted multi-user sandbox. Persisted CLI credentials are sensitive; restrict project access and protect backups. No credentials are embedded in this template.

## Startup and upgrades

The Docker build installs checksum-locked runtimes at their final absolute prefix, then keeps an immutable seed outside the mount. First boot copies that seed onto an empty volume without downloading tools. The mise store is published through an atomic rename; a completion marker is written only after all initial defaults succeed.

Existing files, symlinks, global configuration, and installed versions are not overwritten. Later boots do not reapply defaults or resurrect removed tools. Bootstrap never executes user profiles, mise configuration, hooks, or repository code. Unsafe/conflicting initialization paths fail with an actionable log message instead of destructive repair.

New image defaults apply to new workspaces only. An existing workspace keeps its tool choices; upgrade explicitly after taking a backup. The fixed mise binary and OS packages change when you deploy an updated image. The Debian base digest and starter artifact checksums are pinned; Debian package security updates are resolved during image builds.

## Backups and recovery

Daily backups are configured for the volume. Check Railway's backup settings after deployment and take a manual backup before major changes. Important source code should also be pushed to Git. Backups include any secrets stored in the home directory.

A CLI/API backup restore can create a new, detached volume. Wait for the restore workflow to finish, attach the restored volume at `/root` to the intended service, and wait for its replacement deployment. Verify project files, virtual environments, and installed tools before removing the original volume. Recheck the backup schedule on the restored volume. Volume operations return before their deployments and attachment metadata have fully settled.

For a bad project configuration or shell profile, connect with a clean shell:

```sh
railway ssh --service workspace -- /bin/bash --noprofile --norc
```

Use `/usr/local/bin/mise` and image utilities directly if shims are broken. Do not delete `.mise-workspace-initialized` to force a reset: restore from backup or explicitly repair the affected files. A missing/unwritable volume or unsafe initialization path intentionally prevents startup; fix its mount/path through Railway instead of starting an ephemeral workspace.

## Local verification

Requires Node and Docker with Linux/amd64 support:

```sh
npm ci --ignore-scripts
npm run build
npm test
```

The tests use fresh Docker volumes with `volume-nocopy` to reproduce Railway's empty mount. They exercise offline startup, configuration safety, real runtime execution, extra-tool and virtual-environment persistence across offline replacement, project trust, and process shutdown.

See the [release verification report](docs/VERIFICATION.md) for the actual Railway redeployment, fresh-template, and backup restore results.

For a local workspace:

```sh
docker compose up -d --build
docker compose exec workspace bash -l
```

`docker compose down` retains the named volume. Do not add `--volumes` unless you intend to delete its data.

## Railway configuration and attribution

Native Railway IaC lives in [.railway/railway.ts](.railway/railway.ts). It describes the private service, persistent mount, resource caps, restart policy, and backups. Review `npm run railway:plan` before applying it to a linked project. There is no deprecated `railway.json` or `railway.toml`.

Planning and applying read existing `workspace` variable names through the authenticated Railway CLI and mark them for preservation, including sealed variables. These reads use the authoring context's exact project and environment IDs; a failed or ambiguous read stops the operation. Values are not copied into the authored configuration. This preserves owner-added variables while keeping the native `railway config plan` and `railway config apply` workflow. Review the plan for deletions and keep `--confirm-destructive` unset to retain the native destructive-change guard if variables change concurrently.

This independent template wraps [mise](https://github.com/jdx/mise), [Debian](https://www.debian.org/), [Node.js](https://nodejs.org/), [Python](https://www.python.org/), [python-build-standalone](https://github.com/astral-sh/python-build-standalone), and [uv](https://github.com/astral-sh/uv). They retain their respective licenses. Template glue is MIT licensed and is not an official Railway or mise distribution.
