# Deploy and Host Persistent mise Workspace on Railway

A private, persistent Debian Linux workspace with mise-managed developer tools. Node.js, Python, and uv are ready on the first boot—even without runtime downloads. Connect through Railway's managed SSH and keep your projects, installed runtimes, virtual environments, and settings across redeployments.

## About Hosting

This template deploys one SSH-first workspace service with one 5000 MB persistent volume mounted at `/root`. Daily backups are configured, sleeping is disabled, and the initial limits are 2 vCPU and 2 GiB memory. Increase capacity for larger projects as your Railway plan permits. Usage is billed by Railway; resource limits are not a monthly cost estimate.

There is no public domain, exposed SSH daemon, browser terminal, or hosted IDE. You access it using your Railway account and the Railway CLI. No application password or AI-provider key is required.

## Common Use Cases

- Keep a personal development shell and repositories available independently of your laptop.
- Install and retain multiple language runtimes using mise.
- Work on Node.js and Python projects with persistent dependencies and virtual environments.
- Run trusted maintenance tools and scripts in a private workspace.
- Keep a tmux session running across SSH disconnects.

## Dependencies for Persistent mise Workspace Hosting

### Deployment Dependencies

- A Railway account with persistent-volume support.
- The Railway CLI and project access for managed SSH.
- Network access when explicitly adding tools or installing project dependencies.

The image includes Debian 13 slim for Linux/amd64, mise 2026.9.3, Node 24.21.0, Python 3.13.15, uv 0.12.11, Bash, Git, SSH client, tmux, common shell utilities, and native build tools. Starter runtimes are checksum-locked and baked into the image.

### Implementation Details

The persistent home stores projects, mise tools/configuration, shell settings, virtual environments, and owner-created CLI credentials. Startup seeds an empty home safely, preserves existing user choices, and never automatically upgrades tools or runs repository hooks. Paranoid mise trust requires explicit project approval and reapproval after configuration changes. A thin launcher blocks inherited `CI=true` auto-approval in the pinned mise release; the README explains how to launch CI-dependent programs explicitly.

This is a trusted-owner workspace with root inside the container, not on Railway's host. It is not a sandbox for untrusted users. Protect project access and backups because the home can contain credentials.

Only `/root` is persistent. Changes to OS packages outside the home disappear on image replacement. Running processes and tmux sessions do not survive a restart or redeploy. Take backups before major changes and keep important source code in Git. New image defaults do not overwrite an existing workspace's tool versions or dotfiles.

## Why Deploy Persistent mise Workspace on Railway

Railway supplies private managed SSH, persistent storage, backup controls, and deployment management. This template adds a small, ready-to-use developer environment with predictable first boot and explicit tool upgrades. Start with the included runtimes and install more only when you need them.
