#!/bin/sh
# First-boot setup for the Lightsail instance (runs once, as root, via cloud-init).
# Installs Docker from Docker's apt repository and prepares /opt/rizn for the deploy workflow.
# Lightsail appends this to its own /bin/sh launch script, so it must be POSIX sh (no bashisms).
# Edits only affect newly created instances (main.tf ignores user_data changes on a running one).
set -eux
export DEBIAN_FRONTEND=noninteractive

# Swap gives headroom on the 2 GB plan (image builds happen in CI, not here).
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
usermod -aG docker ubuntu

# Keys only, no root login.
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' \
  > /etc/ssh/sshd_config.d/90-rizn.conf
# Ubuntu 24.04 starts sshd on demand; this is a no-op when it isn't running yet.
systemctl try-reload-or-restart ssh

install -d -o ubuntu -g ubuntu -m 750 /opt/rizn
