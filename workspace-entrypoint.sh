#!/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH
umask 077

fail() {
  printf 'workspace bootstrap: %s\n' "$1" >&2
  exit 1
}

ensure_directory() {
  path=$1
  if [ -L "$path" ] || { [ -e "$path" ] && [ ! -d "$path" ]; }; then
    fail "unsafe or conflicting path: $path"
  fi
  [ -d "$path" ] || mkdir "$path" || fail "cannot create $path"
}

copy_default() {
  source=$1
  destination=$2
  if [ -L "$destination" ]; then
    return
  fi
  if [ -e "$destination" ]; then
    [ -f "$destination" ] || fail "unsafe or conflicting path: $destination"
    return
  fi
  [ -f "$source" ] && [ ! -L "$source" ] || fail "verified seed file is missing: $source"
  temporary=$(mktemp "${destination}.tmp.XXXXXX") || fail "cannot stage $destination"
  cp "$source" "$temporary" || fail "failed to copy default: $destination"
  chmod 600 "$temporary" || fail "cannot protect $destination"
  mv -T -n "$temporary" "$destination" || fail "cannot install $destination"
  [ ! -e "$temporary" ] || fail "path appeared while installing: $destination"
}

[ "$(id -u)" = 0 ] || fail 'must run as root'
mountpoint -q /root || fail 'persistent /root mount is required'
writable_probe=$(mktemp /root/.workspace-writable.XXXXXX 2>/dev/null) ||
  fail 'persistent /root mount must be writable'
rm -f "$writable_probe" || fail 'persistent /root mount must be writable'

marker=/root/.mise-workspace-initialized
if [ -L "$marker" ]; then
  fail "unsafe or conflicting path: $marker"
elif [ -e "$marker" ]; then
  [ -f "$marker" ] && [ "$(cat "$marker")" = 1 ] ||
    fail "unsafe or conflicting path: $marker"
  exec /usr/bin/sleep infinity
fi

ensure_directory /root/.local
ensure_directory /root/.local/share

data_store=/root/.local/share/mise
data_seed=/opt/workspace-seed/mise-data
if [ -L "$data_store" ] || { [ -e "$data_store" ] && [ ! -d "$data_store" ]; }; then
  fail "unsafe or conflicting path: $data_store"
fi
if [ ! -e "$data_store" ]; then
  [ -d "$data_seed" ] && [ ! -L "$data_seed" ] || fail 'verified mise seed is missing'
  data_temporary=$(mktemp -d /root/.local/share/.mise.tmp.XXXXXX) ||
    fail 'cannot stage mise seed'
  cp -a "$data_seed/." "$data_temporary/" || fail 'failed to copy mise seed'
  chmod -R go-rwx "$data_temporary" || fail 'cannot protect mise seed'
  mv -T -n "$data_temporary" "$data_store" || fail 'cannot install mise seed'
  [ ! -e "$data_temporary" ] || fail 'mise data path appeared during initialization'
fi

ensure_directory /root/.config
ensure_directory /root/.config/mise
copy_default /opt/workspace-seed/home/.config/mise/config.toml /root/.config/mise/config.toml
copy_default /opt/workspace-seed/home/.config/mise/mise.lock /root/.config/mise/mise.lock
copy_default /opt/workspace-seed/home/.bashrc /root/.bashrc
copy_default /opt/workspace-seed/home/.bash_profile /root/.bash_profile

if [ ! -e /root/projects ] && [ ! -L /root/projects ]; then
  mkdir /root/projects || fail 'cannot create /root/projects'
fi

marker_temporary=$(mktemp /root/.mise-workspace-initialized.tmp.XXXXXX) ||
  fail 'cannot stage initialization marker'
printf '1\n' >"$marker_temporary" || fail 'cannot write initialization marker'
chmod 600 "$marker_temporary" || fail 'cannot protect initialization marker'
mv -T -n "$marker_temporary" "$marker" || fail 'cannot install initialization marker'
[ ! -e "$marker_temporary" ] || fail 'marker path appeared during initialization'

exec /usr/bin/sleep infinity
