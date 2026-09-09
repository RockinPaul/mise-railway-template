# Persistent mise Workspace Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Publish a private Railway SSH workspace whose projects, settings, and installed mise runtimes survive replacement without startup downloads.

**Architecture:** One pinned Debian 13 Linux/amd64 image with mise and a small prebuilt Node/Python/uv seed. One `/root` Railway volume preserves the owner's home. A minimal startup script initializes missing seed data safely and runs an idle worker through tini; no public listener, extra authentication service, or SSH daemon.

**Tech Stack:** Debian 13 slim, pinned mise release artifact/checksum, Node active LTS, Python 3.13, uv, Bash, POSIX shell, Node built-in tests, Docker, Railway native IaC/CLI and template change-set API.

## Approved contract

- User approved the research-backed design at `/Users/pavelzarudnev/Mise-Railway-Workspace-Design-2026-09-09.md` and asked for implementation; do not repeat the approval gate.
- Container-local `/root` is the sole persistent mount. Do not repurpose the host/operator HOME.
- Image-managed OS/mise utilities stay outside the volume. User installations under the home remain; manual `/usr` changes and running processes do not.
- No startup `mise install`, `mise upgrade`, user profile execution, repository cloning, or project hooks. Baseline installation happens in the image build, using verified public artifacts.
- Pinned starter tools: Node current active LTS, Python 3.13 maintenance release, uv; exact versions/checksums must be recorded before publication.
- Defaults: install jobs2, paranoid config trust, command-not-found and exec auto-install disabled, precompiled Python preferred. Do not blanket-trust the project tree.
- Bash interactive activation plus noninteractive `mise exec`/shims; test actual Railway SSH identity, home, and tool resolution before publishing.
- One replica, sleeping off, proposed 2 vCPU/2 GB limit, explicit 5000 MB initial volume, daily backups. Validate platform behavior rather than infer settings from the template generator.
- Use a maintained root-owned base and safe startup PATH. Owner SSH can run root commands inside this personal container; no untrusted multi-tenant guarantee.

## Task 1: Artifact and image baseline

Files: `Dockerfile`, `workspace-defaults/config.toml`, `workspace-defaults/.bashrc`, `workspace-defaults/.bash_profile`, `tests/image.test.mjs`.

1. Resolve official release artifacts for mise/Node/Python/uv; record version and checksum provenance. Prefer conservative x86_64 precompiled Python.
2. Write failing tests asserting exact baseline versions, root/home path, external immutable mise binary, safe global settings, and an image seed outside `/root`.
3. Build dependencies and install the baseline at its final prefix `/root/.local/share/mise`. Generate the global lockfile with `mise lock --global`.
4. Copy the complete tool data to `/opt/workspace-seed/mise-data`, and seed config/profiles to `/opt/workspace-seed/home`. Preserve absolute prefixes rather than relocating executable paths.
5. Runtime image keeps mise at `/usr/local/bin/mise` and the seed under `/opt`; startup cannot depend on files hidden by the volume. Use tini as PID1 and a fixed idle child after initialization.
6. Run real Docker tests for tool versions and shell activation. Tests use `volume-nocopy` to reproduce Railway's empty mount, not Docker's automatic image-volume population.

## Task 2: Safe persistent bootstrap (independent implementation unit)

Files: `workspace-entrypoint.sh`, `tests/bootstrap.test.mjs`.

1. Write tests before the script; capture expected RED for missing implementation.
2. Implement fixed `/root` mount and writability validation, safe directory creation, and missing-only seeding. Existing dotfiles/config/tool choices are never overwritten.
3. Copy a missing whole mise store through a temporary sibling directory and publish it atomically. An interrupted temporary copy must not be mistaken for a completed installation. Preserve an existing store rather than overwriting it or attempting destructive recovery.
4. Mark first initialization only after successful publication/config setup. On later boots, do not resurrect deliberately removed tools or reapply defaults.
5. Never execute user-owned volume content at startup; use a trusted PATH and explicit system utilities. Do not follow unsafe symlink parents into unrelated filesystem paths while seeding. Preserve intentional preexisting user files, including dotfile symlinks, without writing through them.
6. Verify first boot, repeated boot, existing-user-content preservation, missing-volume failure, interrupted initialization, corrupt/conflicting paths, and malicious startup hooks. No tests are silently skipped.
7. Independent spec review, then independent code/security review; fix findings and rerun tests before commit.

## Task 3: Runtime persistence proof

Files: `tests/workspace.test.mjs`, `compose.yaml`, test artifacts under ignored `artifacts/`.

1. Start an empty volume with networking disabled; verify the advertised baseline works without downloads.
2. Create a project file, dotfile, Python venv, and an extra installed mise version/tool. Recreate the container using the same volume with networking disabled; verify the exact files and executable versions.
3. Change user-global config, remove/replace a default file, and verify startup preserves that state.
4. Verify interactive Bash activation, login/noninteractive execution, and per-project environment selection. A bad project config must not break the plain repair shell.
5. Verify untrusted and modified configs cannot run marker-producing hooks under paranoid mode, including with CI=true.
6. Verify graceful stop and no bootstrap child/zombie accumulation. Test tmux detach/reattach separately from container replacement.

## Task 4: Railway and repository

Files: `.railway/railway.ts`, `.railway/template-variables.json`, package files, CI, README, license/attribution.

1. Create `RockinPaul/mise-railway-template` after name availability check. Push reviewed implementation.
2. Create a short-named reference project; verify ID before every scoped mutation. Add one private service, `/root` volume, sleeping off, and supported resource/backup settings using CLI/API.
3. Use explicit GitHub source and preserve user variables in native IaC. Preview for no unintended deletes. Never use deprecated railway.toml/json.
4. Verify actual managed SSH UID/home, interactive tool selection, one-shot commands, and tool/file/venv recovery across Railway redeployment.
5. Verify backup creation and restore into a task-owned test instance if supported without risking reference data; otherwise clearly report what could not be proven.

## Task 5: Template publication and final verification

Files: `TEMPLATE_OVERVIEW.md`, `TEMPLATE_DESCRIPTION.txt`, README deploy badge and final evidence.

1. Match established overview sections, description at most75characters, and clearly describe root-owner access, what persists, no autosave of processes, and no hosted browser IDE.
2. Generate a draft from the tested project, then set metadata/defaults through the authenticated internal `templateChangeSetStage`/`templateChangeSetApply` API. Set explicit 5000 MB initial volume size with `templateVolumeUpdate`; verify all data by readback.
3. Publish through CLI/API. Create an isolated fresh project with a short valid name and assert its exact ID before `railway deploy`.
4. Verify the real published template: no public domains, correct mount/size/backup settings, SSH-ready baseline, and added-tool persistence across replacement. No reference files or credentials may be copied.
5. Delete only verified task-owned smoke resources; retain the reference workspace. Add the actual deploy button with the user's existing referral parameters, push, and verify the public listing/README/CI.

## Progress

- [x] Approved design and Docker/GitHub/Railway access checked.
- [ ] Exact artifacts and Docker baseline.
- [ ] Bootstrap TDD and independent review.
- [ ] Offline first boot and additional-tool persistence.
- [ ] Railway SSH, redeploy, and backup verification.
- [ ] Published template and fresh-copy checks.
- [ ] Cleanup and final handoff.
