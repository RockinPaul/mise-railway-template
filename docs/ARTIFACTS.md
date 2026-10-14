# Starter artifact provenance

Runtime artifacts verified on 2026-09-09; the mise binary re-verified on 2026-10-14. Runtime checksums and exact URLs are committed in `workspace-defaults/mise.lock`.

- Debian 13 slim manifest: `sha256:d7e12182ce18b85b93007c1dedf31f2d29e01ccf3182cc4017c709b6259bc132`, built for Linux/amd64.
- mise 2026.10.9 [release](https://github.com/jdx/mise/releases/tag/v2026.10.9), raw Linux x64 SHA-256 `6ab6646b52b83f6bbd51c9d0d3ae54264ffa90efd1ac6d7c0ec5a86bbc6a0030`, verified on 2026-10-14 against the official `SHASUMS256.txt`, whose minisign signature checks out against upstream's `minisign.pub` (key `64113EDF160FDEC2`). Docker verifies the checksum before adding it. Previously 2026.9.3, `981bd9179cc089114a87b491fce2c4007ab05b5445dee7ad08e87e5dffcc154d`.
- Node 24.21.0, Active LTS Krypton on the verification date: [release index](https://nodejs.org/dist/index.json), [lifecycle schedule](https://github.com/nodejs/Release/blob/main/schedule.json). Its lifecycle progresses independently of this template; pins require maintainer updates.
- Python 3.13.15 uses the baseline x86_64 glibc, non-freethreaded, `install_only_stripped` artifact from [python-build-standalone 20260901](https://github.com/astral-sh/python-build-standalone/releases/tag/20260901). `MISE_PYTHON_PRECOMPILED_ARCH=x86_64` avoids selecting a CPU-specific x86_64_v3 build.
- uv 0.12.11 [release](https://github.com/astral-sh/uv/releases/tag/0.12.11), Linux x86_64 glibc archive.

The committed global lock was generated inside the pinned base with mise 2026.9.3 using `mise lock --global --platform linux-x64`. The runtime pins did not move with the mise bump to 2026.10.9, so the lock was kept. It is lockfile format 1; mise 2026.10.9 writes format 3, still reads format 1, and starts warning about it on 2027-03-14, so regenerate the lock before then. The image installs with `MISE_LOCKED=1`. The lock records supported artifact checksums and provenance; it is not an offline mode or a full lock of every installer/backend dependency.

Tools are installed under `/root/.local/share/mise` during the seed stage, including hidden backend metadata. Copying and restoring the entire tree to the identical prefix preserves Python sysconfig and other absolute install paths. Runtime initialization only copies image data; no network is needed.

## Pinned mise trust workaround

Revalidated on 2026-10-14 for 2026.10.9: with a paranoid global configuration, an untrusted project whose `mise.toml` runs a command from a template, and `CI=true`, the raw 2026.9.3 binary evaluated the file and ran the command, while the raw 2026.10.9 binary refused with "Config files in ~/proj/mise.toml are not trusted", with and without `CI`. The fix ([#13796](https://github.com/jdx/mise/pull/13796)) only applies in paranoid mode: with paranoid off, `CI` or `MISE_YES` still auto-trusts a project, and the workspace owner can turn paranoid off in their own configuration. The launcher therefore stays, still refusing inherited `CI`.

In 2026.9.3, [settings initialization](https://github.com/jdx/mise/blob/v2026.9.3/src/config/settings.rs#L1111) forces auto-confirmation for `CI=true`; [trust checking](https://github.com/jdx/mise/blob/v2026.9.3/src/config/config_file/mod.rs#L529) then grants project trust even with paranoid mode. Global `ci="false"` and `MISE_YES=0` do not override inherited CI. This was reproduced with a marker-producing project configuration.

`mise-launcher.sh` refuses that inherited auto-approval and otherwise delegates unchanged. Shims resolve to the first `mise` on PATH, which is the launcher at `/usr/local/bin/mise`, and the upstream `__MISE_BIN` override covers the fallback, so generated activation and shims stay on the launcher; Bash `exec -a` preserves shim command selection. Tests regenerate shims and exercise both ordinary trust and the CI regression. Revalidate this workaround on every mise upgrade. Retire it only if upstream stops auto-trusting under `CI` regardless of paranoid mode.

Update procedure: update exact versions in `config.toml`, generate and inspect a new Linux x64 global lock, verify the mise checksum and base digest, build, run every Docker test, then test a fresh Railway deployment and an existing-volume redeploy. Back up existing workspaces before upgrading the image. Do not regenerate runtime defaults on every startup.
