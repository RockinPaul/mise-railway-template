# syntax=docker/dockerfile:1
FROM debian:13-slim@sha256:d7e12182ce18b85b93007c1dedf31f2d29e01ccf3182cc4017c709b6259bc132 AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash ca-certificates curl git openssh-client jq ripgrep tmux \
    tar gzip bzip2 xz-utils unzip zip less procps util-linux tini \
    build-essential pkg-config libssl-dev libffi-dev zlib1g-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

ADD --checksum=sha256:f9612efcddda0ae55b62d3b6f82a6c860d5b54ebee0807d4f1a1d578055e1607 --chmod=755 \
    https://github.com/jdx/mise/releases/download/v2026.10.11/mise-v2026.10.11-linux-x64 /usr/local/libexec/mise
COPY --chmod=755 mise-launcher.sh /usr/local/bin/mise

ENV LANG=C.UTF-8 \
    MISE_PYTHON_PRECOMPILED_ARCH=x86_64

FROM base AS seed
WORKDIR /root
COPY workspace-defaults/config.toml workspace-defaults/mise.lock /root/.config/mise/
RUN MISE_LOCKED=1 mise install \
    && mise reshim \
    && mkdir -p /opt/workspace-seed/home/.config/mise \
    && cp -a /root/.local/share/mise /opt/workspace-seed/mise-data \
    && cp -a /root/.config/mise/config.toml /root/.config/mise/mise.lock /opt/workspace-seed/home/.config/mise/
COPY workspace-defaults/.bashrc workspace-defaults/.bash_profile /opt/workspace-seed/home/

FROM base AS workspace
COPY --from=seed /opt/workspace-seed /opt/workspace-seed
COPY --chmod=755 workspace-entrypoint.sh /usr/local/bin/workspace-entrypoint
WORKDIR /root/projects
ENV PATH=/root/.local/share/mise/shims:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/workspace-entrypoint"]
CMD []
