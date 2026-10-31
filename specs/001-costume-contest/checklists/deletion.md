# Deletion Record: RIZN Fear Factor 2026

The documented data-deletion procedure (constitution Principle IX), run when the event server was
shut down for the off-season (spec 004, T020).

- **Date**: 2026-10-31 (Edmonton)
- **Operator**: Chase Buhler, with Claude Code running the commands
- **Server**: Lightsail instance `rizn-fear-factor`, ca-central-1, static IP 3.98.19.181

## Steps run

- [x] DNS for `fearfactor.riznyouth.com` moved to the off-season static site on CloudFront
  first, so the address kept working (spec 004, T019).
- [x] Purged all event data on the server:
  `cd /opt/rizn && docker compose exec -T app npm run purge -- --all`
  - Output: `Deleted 118 photo files and all contest data.` (59 costumes, full size plus thumbnail)
- [x] Removed the containers and every volume: `docker compose down -v`
  - Removed volumes `rizn-fear-factor_pgdata` (database), `rizn-fear-factor_photos`, and
    `rizn-fear-factor_caddy_data`. Afterwards `docker compose ps -a` and `docker volume ls` were
    empty.
- [x] Destroyed the server: Actions → *Infrastructure* → `destroy`
  ([run 41251565296](https://github.com/Celebration-Dev-Connect/rizn-fear-factor/actions/runs/41251565296),
  success). This deleted the instance, its disk, the static IP, and the firewall rules.
- [x] Verified in ca-central-1: `aws lightsail get-instances`, `get-static-ips`, `get-disks`, and
  `get-instance-snapshots` all return `[]`.
- [x] Removed the GitHub variables `SERVER_IP` and `SSH_KNOWN_HOSTS` (production environment).

## What still exists

- **The offline photo archive** (constitution v3.0.0): 59 costume photos, photo only, with no
  names, nicknames, votes, or pass data. It's at `RIZN Fear Factor 2026 - costume photos/` and
  its `.zip`, on leadership-controlled storage. It's never published without fresh parental
  consent.
- **No student data online.** The off-season static page holds no photos, names, or passes.
- **Kept for next year**: the Terraform state bucket and GitHub OIDC role (`infra/bootstrap`), the
  static-site stack (`infra/static-site`), and the app secrets in the `production` environment
  (rotate them before the 2027 event).
