#!/bin/bash
# mise 2026.9.3 auto-approves config trust when CI is true, even in paranoid mode.
# Refuse that implicit approval; do not silently change CI for child programs.
case "${CI:-false}" in
    ''|0|false|FALSE) ;;
    *) printf '%s\n' 'Workspace mise refuses CI auto-approval. Use env -u CI mise; launch CI-dependent programs with env -u CI mise exec -- env CI=true COMMAND.' >&2
       exit 1 ;;
esac

# Keep activation and regenerated shims on this guard; retain shim argv[0].
export __MISE_BIN=/usr/local/bin/mise
exec -a "$0" /usr/local/libexec/mise "$@"
