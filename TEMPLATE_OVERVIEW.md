# Deploy and Host Persistent mise Workspace on Railway

A private [Debian](https://www.debian.org/) Linux workspace with [mise](https://mise.jdx.dev/) for managing developer tools. [Node.js](https://nodejs.org/), [Python](https://www.python.org/), and [uv](https://docs.astral.sh/uv/) are ready on the first boot without runtime downloads. Connect through [Railway's managed SSH](https://docs.railway.com/cli/ssh) and keep your projects, installed runtimes, virtual environments, and settings across redeployments.

## About Hosting

The template deploys one `workspace` service on [Railway](https://railway.com/) with a **5000 MB persistent volume mounted at `/root`**, daily backups, and sleeping disabled. Initial limits are 2 vCPU and 2 GiB memory; increase them for larger workloads as your plan permits. These are resource caps, not reserved capacity or a monthly price estimate.

There is no public domain, exposed SSH daemon, browser terminal, or hosted IDE. No application password or AI-provider key is required. Your Railway account controls access. This is a trusted-owner workspace with root inside the container—not on Railway's host and not an untrusted multi-user sandbox.

## Common Use Cases

- Keep a development shell and repositories available independently of your laptop.
- Install and retain multiple language runtimes with mise.
- Work on Node.js and Python projects with persistent dependencies and virtual environments.
- Run trusted maintenance scripts and command-line tools.
- Keep work running in tmux while your SSH connection is disconnected.

## How to Use the Workspace

### 1. Deploy and connect from your computer

Deploy this template and wait for the `workspace` service to start. Install the [Railway CLI](https://docs.railway.com/guides/cli) **on your own computer** using the instructions for your operating system; it is not a required tool inside the workspace.

Run these commands locally:

```sh
mkdir -p railway-mise
cd railway-mise
railway login
railway link
railway ssh --service workspace
```

In `railway link`, select the project you just deployed and its `production` environment. The local folder stores your project association; your actual remote project files will live under `/root/projects`. Alternatively, copy the exact SSH command from the service's Railway dashboard. See the [project-linking guide](https://docs.railway.com/cli/link) and [SSH reference](https://docs.railway.com/cli/ssh).

### 2. Create a project inside the workspace

After SSH connects, the following commands run **inside the remote Linux workspace**:

```sh
cd /root/projects
mkdir my-project
cd my-project
node --version
python --version
uv --version
```

Keep repositories, dependencies, and generated files under `/root`. You can use Git to clone your own repository into `/root/projects`; private repositories need your own Git credentials. SSH disconnects do not delete these files.

### 3. Select or install language runtimes

Mise manages tool versions without replacing system packages. To pin the included Node version for the current project:

```sh
cd /root/projects/my-project
mise use --pin node@24.21.0
mise exec -- node --version
```

To add another tool, such as [Bun](https://bun.sh/), as your workspace-wide default:

```sh
mise use --global --pin bun@latest
bun --version
```

Bun is an optional example, **not preinstalled**. This explicit command downloads a release and saves its concrete version; it does not upgrade on every restart. Adding tools requires internet access and may encounter upstream API rate limits. Use `mise ls` to inspect installed and selected versions. See [mise use](https://mise.jdx.dev/cli/use.html) for project/global configuration and pinning.

Interactive Bash activates mise automatically. Use `mise exec -- COMMAND` when a script also needs a project's configured environment. Automatic installation during command lookup or `mise exec` is disabled: install/select missing tools explicitly with `mise use` or `mise install`.

### 4. Use Python virtual environments and Node packages

For a Python project, run inside its project directory:

```sh
python -m venv .venv
source .venv/bin/activate
python -c 'import sys; print(sys.executable)'
deactivate
```

To add Python packages, activate that environment and use `uv pip install PACKAGE`, replacing `PACKAGE` with the package you need. The `.venv` directory persists with the project. See [uv's environment guide](https://docs.astral.sh/uv/pip/environments/).

For a new Node project, `npm init -y` creates its package manifest. Use `npm install PACKAGE` to add a dependency, replacing `PACKAGE` with its name. Keep the project and `node_modules` under `/root/projects`; see the [npm documentation](https://docs.npmjs.com/).

### 5. Keep commands running when you disconnect

Inside the workspace, start or reattach a named [tmux](https://github.com/tmux/tmux/wiki) session:

```sh
tmux new-session -A -s work
```

Run your commands there. Press `Ctrl-b`, then `d`, to detach, and type `exit` in the outer shell to disconnect. On your next SSH connection, run the same tmux command to reattach. A Railway restart or redeploy ends running processes and tmux sessions; persistent storage does not preserve process state.

### 6. Review project configuration before trusting it

Paranoid mode requires approval for project mise configuration, including renewed approval after changes. When a downloaded repository contains `mise.toml`, inspect it before using [mise trust](https://mise.jdx.dev/cli/trust.html). Only run `mise trust` in that project after you accept its configuration. Do not blanket-trust `/root` or the entire projects tree. Trust is permission to execute configuration, not a sandbox.

The pinned mise release auto-approves trust when it inherits `CI=true`, even in paranoid mode. This template's launcher therefore refuses mise and shim commands in that environment. To deliberately run a CI-dependent program **after reviewing and trusting its project**, use:

```sh
env -u CI mise exec -- env CI=true YOUR_COMMAND
```

Replace `YOUR_COMMAND` with the real program and arguments. This clears CI while mise loads configuration, then restores it for your program.

### 7. Back up and recover your workspace

Check the volume's [Railway backup settings](https://docs.railway.com/volumes/backups) after deployment. Take a manual backup before major changes, and push important source code to Git as well. Backups include any credentials you store in the home directory, so restrict access to the Railway project.

To start a dashboard restore, open the `workspace` service's **Backups** tab, select the desired backup date, and click **Restore**. When preparation finishes, open **Details**, check that the restored volume will mount at `/root`, then click **Deploy**. See Railway's [restore guide](https://docs.railway.com/volumes/backups#how-to-restore-a-backup) for the complete flow.

A CLI/API restore can create a new detached volume. Wait for the restore workflow to finish, attach the restored volume at `/root` to the intended service, and wait for its replacement deployment. Verify files, virtual environments, and installed tools before removing the original volume. Recheck the backup schedule on the restored volume; API success responses can arrive before attachment and deployment are ready.

If a shell profile or project configuration is broken, start a clean shell **from your own computer**:

```sh
railway ssh --service workspace -- /bin/bash --noprofile --norc
```

Image utilities remain available for repairs. If the service cannot start, inspect its Railway logs and confirm that the `/root` volume is attached and writable. Bootstrap deliberately refuses an absent or unsafe mount rather than creating an apparently persistent workspace on ephemeral storage. Do not delete the initialization marker to force a reset.

## Dependencies for Persistent mise Workspace Hosting

### Deployment Dependencies

- [Railway](https://railway.com/): hosts the private service and supplies managed SSH, persistent storage, and backups.
- [Railway CLI](https://docs.railway.com/guides/cli): runs on your computer for authentication, project selection, and remote access.
- A Railway account with volume support and access to the deployed project. No additional database, Redis service, web gateway, or external application subscription is needed.

### Included Software

The starter runtime versions are pinned in the image; these are the template's bundled versions, not a promise that each is the newest upstream release.

- [Debian 13 slim](https://www.debian.org/): the Linux/amd64 operating-system base.
- [mise 2026.10.9](https://mise.jdx.dev/): runtime installation, version selection, and project environments.
- [Node.js 24.21.0](https://nodejs.org/) and [npm](https://docs.npmjs.com/): JavaScript execution and package management.
- [Python 3.13.15](https://www.python.org/): Python execution and virtual environments, using redistributable binaries from [python-build-standalone](https://github.com/astral-sh/python-build-standalone).
- [uv 0.12.11](https://docs.astral.sh/uv/): Python package and environment tooling.
- [Bash](https://packages.debian.org/trixie/bash), [GNU Coreutils](https://packages.debian.org/trixie/coreutils), and [less](https://www.greenwoodsoftware.com/less/): the interactive shell, everyday file utilities, and text viewing.
- [Git](https://git-scm.com/) and the [OpenSSH client](https://www.openssh.org/): source control and outbound SSH access. The image does not run an OpenSSH server.
- [curl](https://curl.se/), [jq](https://jqlang.org/), and [ripgrep](https://github.com/BurntSushi/ripgrep): HTTP requests, JSON processing, and fast text search.
- [tmux](https://github.com/tmux/tmux/wiki): terminal sessions that survive SSH disconnects.
- [Tini](https://github.com/krallin/tini): the container's init process for signal forwarding and child-process reaping; it is not systemd or a full VM service manager.
- [procps-ng](https://gitlab.com/procps-ng/procps) and [util-linux](https://github.com/util-linux/util-linux): process inspection and Linux utilities, including the mount check used at startup.
- [tar](https://packages.debian.org/trixie/tar), [gzip](https://packages.debian.org/trixie/gzip), [bzip2](https://sourceware.org/bzip2/), [XZ Utils](https://tukaani.org/xz/), [Zip](https://packages.debian.org/trixie/zip), and [UnZip](https://packages.debian.org/trixie/unzip): archive and compression support.
- Debian [build-essential](https://packages.debian.org/trixie/build-essential), including [GCC/G++](https://gcc.gnu.org/) and [Make](https://packages.debian.org/trixie/make), plus [pkgconf/pkg-config](https://github.com/pkgconf/pkgconf): common native-extension build tooling.
- [OpenSSL](https://openssl-library.org/), [libffi](https://sourceware.org/libffi/), and [zlib](https://zlib.net/) development dependencies, plus Debian's [CA certificates](https://packages.debian.org/trixie/ca-certificates): TLS trust and libraries needed by common native builds.

### Build and Maintenance Tools

[Docker](https://docs.docker.com/) builds the image, [GitHub Actions](https://docs.github.com/en/actions) runs its verification workflow, and the [Railway TypeScript SDK](https://github.com/railwayapp/railway-ts-sdk) defines infrastructure. These support the template's development and deployment; they are not additional running services or a bundled Docker daemon inside your workspace.

The [template repository](https://github.com/RockinPaul/mise-railway-template), [Dockerfile](https://github.com/RockinPaul/mise-railway-template/blob/main/Dockerfile), and [artifact provenance](https://github.com/RockinPaul/mise-railway-template/blob/main/docs/ARTIFACTS.md) document the package selection and runtime checksums. Upstream projects retain their respective licenses; this is an independent template, not an official mise or Railway distribution.

### Implementation Details: What Persists

Everything you store under `/root` is on the volume, including:

- `/root/projects`: repositories, dependencies, generated files, and virtual environments.
- `/root/.config/mise`: global settings and lockfiles.
- `/root/.local/share/mise`: installed runtimes, plugins, and shims.
- `/root/.local/state/mise` and `/root/.cache`: state and caches created by your tools.
- Shell dotfiles, history saved by the shell, and owner-created CLI configuration in the home directory.

First boot safely copies a prebuilt seed from the image into an empty home without downloading runtimes. Later boots preserve your files and version choices: they do not reinstall tools, upgrade packages, overwrite dotfiles, or execute project hooks. New image defaults apply to new workspaces, not as forced changes to existing homes.

The operating system and image-managed mise launcher live outside `/root`. Manual `apt install` changes outside the home disappear on replacement; add permanent OS packages to your fork's Dockerfile. Running processes, tmux sessions, and files in `/tmp` do not persist. This is a container workspace, not a persistent whole-OS virtual machine.

## Why Deploy Persistent mise Workspace on Railway

Railway provides managed access, storage, and deployment controls; this template adds a ready-to-use shell with predictable first boot and explicit tool upgrades. Start with the included runtimes and install more when needed. The [verification report](https://github.com/RockinPaul/mise-railway-template/blob/main/docs/VERIFICATION.md) covers offline Docker tests, actual Railway redeployments, a fresh template deployment, and restoration of project files and a deleted runtime from backup.
