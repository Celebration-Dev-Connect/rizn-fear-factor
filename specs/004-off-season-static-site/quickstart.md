# Quickstart: Off-Season Static Site

## Build and preview locally
```bash
npm run site:build            # next build site → site/out/
npx serve site/out            # or: python3 -m http.server -d site/out 4000
```
Open `/`, `/contest`, and `/crew` (the last two show the page only once deployed, because the
fallback is a CloudFront rule).

## One-time AWS setup
1. Apply the bootstrap policy change (local, admin): `cd infra/bootstrap && terraform apply`. The
   GitHub role gains S3 access to the site bucket and CloudFront invalidation.
2. Actions → *Static site infrastructure* → `apply`. The run summary prints the **certificate
   validation CNAME**. Add it at the riznyouth.com DNS host and leave it there.
3. Re-run `apply` once the certificate shows *Issued* (usually under 10 minutes). The summary
   prints the CloudFront domain `dxxxx.cloudfront.net`.
4. Set the GitHub variables `SITE_BUCKET` and `SITE_DISTRIBUTION_ID` from the outputs.
5. Actions → *Publish site*.

## Verify before switching DNS
```bash
curl -sI https://dxxxx.cloudfront.net/ | head -1                       # 200
curl -s https://dxxxx.cloudfront.net/crew | grep -c "RIZN Youth"     # ≥1
curl -sI --connect-to fearfactor.riznyouth.com:443:dxxxx.cloudfront.net:443 \
  https://fearfactor.riznyouth.com/ | grep -iE "^HTTP|content-security|x-robots"
```

## Cut over
1. At the DNS host, change `fearfactor` from `A 3.98.19.181` to `CNAME dxxxx.cloudfront.net`.
2. `dig +short fearfactor.riznyouth.com` shows CloudFront addresses. Open the site on a phone.

## Shut down the event server (after the cut-over)
1. `ssh … 'cd /opt/rizn && docker compose exec app npm run purge -- --all && docker compose down -v'`
2. Actions → *Infrastructure* → `destroy` (type `destroy`).
3. Record the date and operator in `specs/001-costume-contest/checklists/deletion.md`.
4. Delete the GitHub variables `SERVER_IP` and `SSH_KNOWN_HOSTS`, and the GHCR package.

## Checks (SC-301–SC-306)
- Every old path in [contracts/hosting.md](./contracts/hosting.md) returns 200 with the page.
- Set the phone date after Nov 6, 9:30pm: VANAGEDDON is gone.
- The AWS bill for the next month shows CloudFront/S3 only, under $1.
- Edit `src/content/offseason.ts` and push: live within 10 minutes.
