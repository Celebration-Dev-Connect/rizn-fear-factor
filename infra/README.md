# Deploying to AWS Lightsail

One Lightsail instance in `ca-central-1` runs the existing Docker Compose stack (`app`, `db`, `caddy`).
Terraform creates the server, and GitHub Actions builds and deploys it.

| Piece | What it is |
|---|---|
| `infra/bootstrap/` | Run once from a laptop. Creates the Terraform state bucket and an IAM role that GitHub Actions assumes through OIDC, so no AWS keys are stored anywhere. |
| `infra/lightsail/` | The server: instance (2 GB plan by default), static IP, firewall (80, 443, key-only SSH), and, once a domain exists, the Route 53 `A` record. |
| `.github/workflows/ci.yml` | Typecheck, lint, unit, and integration tests on every push and PR. |
| `.github/workflows/infra.yml` | Manual: Terraform `plan`, `apply`, or `destroy`. |
| `.github/workflows/deploy.yml` | Manual: test, build the image into GHCR, write `/opt/rizn/.env` from GitHub secrets, pull, restart, health check. |

**The repo is public, so nothing secret is committed.** Secrets live only in the GitHub `production`
environment and in `/opt/rizn/.env` on the server (mode 600). Terraform state holds no secrets: the SSH
key it knows is the public half. `.gitignore` blocks `*.tfstate`, `*.tfvars`, `.env`, and key files.

**Every taggable AWS resource carries the tag `app = rizn-fear-factor`** (set once, through the
provider's `default_tags`). AWS doesn't allow tags on Lightsail static IPs, Lightsail firewall rules,
Route 53 records, or S3 bucket settings, so those go untagged. To see the event's cost by tag, activate
`app` once under Billing → Cost allocation tags.

## One-time setup

You need the AWS CLI signed in as an admin, Terraform 1.10+, and `gh` signed in to GitHub.

1. **The domain can wait.** Until it's bought, the app runs at `<ip-with-dashes>.sslip.io`, a free public
   DNS name that resolves to the server's IP and is enough for an HTTPS certificate. See
   [Adding the real domain](#adding-the-real-domain) for the switch.

2. **Make a deploy SSH key** outside the repo:

   ```bash
   ssh-keygen -t ed25519 -N "" -C rizn-deploy -f ~/.ssh/rizn-deploy
   ```

3. **Bootstrap AWS** (local state; keep `infra/bootstrap/terraform.tfstate` somewhere safe):

   ```bash
   cd infra/bootstrap
   terraform init
   terraform apply   # add -var create_oidc_provider=false if the account already has one
   ```

   Two settings may be needed, and both can go in `infra/bootstrap/terraform.tfvars` (gitignored):
   `create_oidc_provider = false` if the account already has a GitHub OIDC provider, and
   `github_sub_prefix` if the repo uses GitHub's immutable OIDC subject (check with
   `gh api repos/OWNER/REPO/actions/oidc/customization/sub`; when `use_immutable_subject` is true, copy
   its `sub_claim_prefix`). Without the right prefix, workflows fail with "Not authorized to perform
   sts:AssumeRoleWithWebIdentity".

4. **Create the GitHub environment.** In the repo: Settings → Environments → New environment →
   `production`. Under *Deployment branches*, allow only `main`. Adding yourself as a required reviewer
   is optional but stops an accidental deploy. Then set its values (`gh` keeps secrets out of shell
   history when piped):

   ```bash
   export GH_REPO=Celebration-Dev-Connect/rizn-fear-factor
   # Variables (not secret)
   gh variable set AWS_ROLE_ARN    --env production --body "$(terraform output -raw aws_role_arn)"
   gh variable set TF_STATE_BUCKET --env production --body "$(terraform output -raw tf_state_bucket)"
   gh variable set EVENT_START     --env production --body 2026-10-30T18:30:00-06:00
   gh variable set EVENT_END       --env production --body 2026-10-30T22:30:00-06:00
   gh variable set PHOTO_DELETE_AT --env production --body 2026-11-02T00:00:00-07:00
   gh variable set SSH_PUBLIC_KEY  --env production --body "$(cat ~/.ssh/rizn-deploy.pub)"
   # Secrets
   gh secret set SSH_PRIVATE_KEY   --env production < ~/.ssh/rizn-deploy
   openssl rand -hex 24 | gh secret set POSTGRES_PASSWORD --env production
   openssl rand -hex 32 | gh secret set SESSION_SECRET --env production
   openssl rand -hex 16 | gh secret set SCREEN_TOKEN --env production
   gh secret set CREW_PASSCODE --env production    # prompts; letters, digits, and dashes only
   ```

   Optional variables: `AWS_REGION` (default `ca-central-1`), `LIGHTSAIL_BUNDLE` (default `small_3_0`,
   2 GB; `medium_3_0` is 4 GB).

   The deploy workflow rejects any value containing characters other than letters, digits, and `._:+/=@-`,
   because Compose would interpret `$`, quotes, or spaces in `.env`.

5. **Create the server.** Actions → *Infrastructure* → Run workflow → `plan`, check it, then run again
   with `apply`. The run summary shows the static IP and the sslip.io hostname:

   ```bash
   gh variable set SERVER_IP  --env production --body <static-ip>
   gh variable set DOMAIN     --env production --body <ip-with-dashes>.sslip.io
   gh variable set PUBLIC_URL --env production --body https://<ip-with-dashes>.sslip.io
   ```

6. **Pin the server's SSH host key** so deploys refuse an impostor. Give the first boot two minutes, then
   compare the fingerprint from your laptop with the one the server reports (Lightsail console → the
   instance → *Connect using SSH*, then `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`):

   ```bash
   ssh-keyscan -t ed25519 <static-ip> | ssh-keygen -lf -           # must match the console
   ssh-keyscan -t ed25519 <static-ip> | gh variable set SSH_KNOWN_HOSTS --env production
   ```

7. **Deploy.** Actions → *Deploy* → Run workflow. It runs the tests, pushes
   `ghcr.io/<owner>/rizn-fear-factor:sha-<commit>`, and finishes when `https://$DOMAIN/healthz` answers.
   The first run waits a little longer while Caddy gets the HTTPS certificate.

Then run the load test against the real server (`LOAD_BASE_URL=https://pass.riznfearfactor.ca npm run test:load`)
and the production rehearsal in `specs/001-costume-contest/quickstart.md`.

## Adding the real domain

1. Buy the domain in Route 53 (for example `riznfearfactor.ca`); this creates its hosted zone. The app
   goes on a subdomain, leaving the root free for a year-round website.
2. Point the variables at it:

   ```bash
   gh variable set ZONE_NAME  --env production --body riznfearfactor.ca
   gh variable set DOMAIN     --env production --body pass.riznfearfactor.ca
   gh variable set PUBLIC_URL --env production --body https://pass.riznfearfactor.ca
   ```

3. Tag the domain and its hosted zone, which Route 53 created outside Terraform:

   ```bash
   aws route53domains update-tags-for-domain --region us-east-1 --domain-name riznfearfactor.ca \
     --tags-to-update Key=app,Value=rizn-fear-factor
   ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name riznfearfactor.ca --query 'HostedZones[0].Id' --output text)
   aws route53 change-tags-for-resource --resource-type hostedzone --resource-id "${ZONE_ID##*/}" \
     --add-tags Key=app,Value=rizn-fear-factor
   ```

4. Run *Infrastructure* → `apply` (it only adds the DNS record), then *Deploy*. Caddy gets a certificate
   for the new name. Passes issued on the sslip.io address don't carry over, so make the switch before
   printing QR codes and before the rehearsal.

## Day to day

- **Ship a change:** run *Deploy* again. It restarts the app for a few seconds, so don't deploy during
  the event.
- **Change a setting or secret:** update the GitHub variable or secret, then run *Deploy*.
- **Get a shell:** `ssh -i ~/.ssh/rizn-deploy ubuntu@<static-ip>`, then `cd /opt/rizn`.
  `docker compose logs -f app` shows the app log.
- **Resize** (for example to 4 GB before event night): set `LIGHTSAIL_BUNDLE`, then run *Infrastructure*
  → `plan` first. Changing the plan replaces the instance, which **deletes the database and photos**,
  so only do it before the event has real data.
- **Don't edit `user-data.sh` after the server exists.** The change replaces the instance too.

## After the event

1. Export anything you're keeping (photos, results) from the server.
2. Purge, as in the main README's data-deletion section, from `/opt/rizn` on the server.
3. Actions → *Infrastructure* → `destroy`, typing `destroy` in *confirm*. This deletes the instance,
   its disks, the static IP, and the DNS record. Automatic snapshots were never on, so no copy remains.
4. Optional: delete the `rizn-fear-factor` package in GitHub → Packages. The images hold code only, no
   event data.
5. Optional, to remove everything: empty the state bucket and run `terraform destroy` in
   `infra/bootstrap`. Keep it if you'll run the event again next year.
