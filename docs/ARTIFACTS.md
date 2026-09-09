# Starter artifact provenance

Verified on 2026-09-09. Runtime checksums and exact URLs are committed in `workspace-defaults/mise.lock`.

- Debian 13 slim manifest: `sha256:d7e12182ce18b85b93007c1dedf31f2d29e01ccf3182cc4017c709b6259bc132`, built for Linux/amd64.
- mise 2026.9.3 [release](https://github.com/jdx/mise/releases/tag/v2026.9.3), raw Linux x64 SHA-256 `981bd9179cc089114a87b491fce2c4007ab05b5445dee7ad08e87e5dffcc154d`. GitHub release API digest and official checksum manifest agree. Docker verifies the checksum before adding it.
- Node 24.21.0, Active LTS Krypton on the verification date: [release index](https://nodejs.org/dist/index.json), [lifecycle schedule](https://github.com/nodejs/Release/blob/main/schedule.json). Its lifecycle progresses independently of this template; pins require maintainer updates.
- Python 3.13.15 uses the baseline x86_64 glibc, non-freethreaded, `install_only_stripped` artifact from [python-build-standalone 20260901](https://github.com/astral-sh/python-build-standalone/releases/tag/20260901). `MISE_PYTHON_PRECOMPILED_ARCH=x86_64` avoids selecting a CPU-specific x86_64_v3 build.
- uv 0.12.11 [release](https://github.com/astral-sh/uv/releases/tag/0.12.11), Linux x86_64 glibc archive.

The committed global lock was generated inside the pinned base with mise 2026.9.3 using `mise lock --global --platform linux-x64`. The image installs with `MISE_LOCKED=1`. The lock records supported artifact checksums and provenance; it is not an offline mode or a full lock of every installer/backend dependency.

Tools are installed under `/root/.local/share/mise` during the seed stage, including hidden backend metadata. Copying and restoring the entire tree to the identical prefix preserves Python sysconfig and other absolute install paths. Runtime initialization only copies image data; no network is needed.

## Pinned mise trust workaround

In 2026.9.3, [settings initialization](https://github.com/jdx/mise/blob/v2026.9.3/src/config/settings.rs#L1111) forces auto-confirmation for `CI=true`; [trust checking](https://github.com/jdx/mise/blob/v2026.9.3/src/config/config_file/mod.rs#L529) then grants project trust even with paranoid mode. Global `ci="false"` and `MISE_YES=0` do not override inherited CI. This was reproduced with a marker-producing project configuration.

`mise-launcher.sh` refuses that inherited auto-approval and otherwise delegates unchanged. The pinned upstream `__MISE_BIN` override keeps generated activation and shims on the launcher; Bash `exec -a` preserves shim command selection. Tests regenerate shims and exercise both ordinary trust and the CI regression. Revalidate this workaround on every mise upgrade; remove it when an upstream fix is verified.

Update procedure: update exact versions in `config.toml`, generate and inspect a new Linux x64 global lock, verify the mise checksum and base digest, build, run every Docker test, then test a fresh Railway deployment and an existing-volume redeploy. Back up existing workspaces before upgrading the image. Do not regenerate runtime defaults on every startup.
