# Deploying `Map-View-Client` to `amphitheater.pashteto.com` (oracle-1)

Manual SSH-based deploy. Target: oracle-1 (`129.146.183.89`, Ubuntu 22.04, ARM, nginx 1.18.0 already running). One-time setup; subsequent re-deploys are just steps 4–5.

Verified state on oracle-1 as of writing:
- nginx **active**, listening on :80 and :443.
- certbot 5.6.0 installed; existing certs for `vpn.pashteto.com`, `mypass.pashteto.com`.
- SSH alias `oracle-1` resolves; login user `ubuntu`; sudo without password.
- Existing vhost convention: `/var/www/<domain>/html/` for content, `/etc/nginx/sites-available/<domain>` for config.

---

## 1. Namecheap — add DNS A record

Where: <https://ap.www.namecheap.com> → Domain List → **pashteto.com** → **Manage** → **Advanced DNS** tab → **Host Records** section.

Click **Add New Record**. Fill:

| Field | Value |
|---|---|
| **Type** | `A Record` |
| **Host** | `amphitheater` (just the subdomain — Namecheap auto-appends `.pashteto.com`) |
| **Value** | `129.146.183.89` |
| **TTL** | `Automatic` (or `5 min` to speed up propagation; revert later) |

Save. Namecheap propagates within ~5–30 min. Verify from your laptop:
```bash
dig +short amphitheater.pashteto.com
# expect: 129.146.183.89
```

If `dig` returns nothing, wait and retry. Don't proceed to step 5 (certbot) until DNS resolves — Let's Encrypt's HTTP-01 challenge needs it.

---

## 2. Build the app for the new domain

On your laptop, from the workspace root:
```bash
cd /Users/dodonovpavel/gavr_mounty/gavr_mounty/Map-View-Client
VITE_BASE_PATH=/ npm run build
```

This produces `dist/` with asset URLs rooted at `/` (instead of `/Map-View-Client/`). `vite.config.ts` reads `VITE_BASE_PATH` with a fallback to the GH-Pages path, so the existing GitHub Pages deploy is unaffected.

Sanity check:
```bash
grep -oE '(href|src)="[^"]+"' dist/index.html | head -3
# expect: href="/vite.svg", src="/assets/...", href="/assets/..."
```

---

## 3. Create the web root on oracle-1

```bash
ssh oracle-1 'sudo mkdir -p /var/www/amphitheater.pashteto.com/html && sudo chown -R ubuntu:ubuntu /var/www/amphitheater.pashteto.com'
```

Blast radius: creates one new directory; doesn't touch existing sites. The `chown` makes subsequent rsync work without sudo.

---

## 4. Upload `dist/` via rsync

```bash
rsync -avz --delete \
  /Users/dodonovpavel/gavr_mounty/gavr_mounty/Map-View-Client/dist/ \
  oracle-1:/var/www/amphitheater.pashteto.com/html/
```

`--delete` removes files on the server that aren't in `dist/` — keeps re-deploys clean. The `/` after `dist` and `html` is important (rsync copies *contents*, not the directory itself).

Quick smoke test once uploaded:
```bash
ssh oracle-1 'ls /var/www/amphitheater.pashteto.com/html/'
# expect: assets/, index.html, vite.svg
```

---

## 5. Nginx vhost (HTTP first, then HTTPS via certbot)

### 5a. Write the HTTP-only vhost

```bash
ssh oracle-1 'sudo tee /etc/nginx/sites-available/amphitheater.pashteto.com > /dev/null' <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name amphitheater.pashteto.com;

    root /var/www/amphitheater.pashteto.com/html;
    index index.html;

    # SPA fallback — every unknown path serves index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long-cache hashed assets (Vite outputs content-hashed filenames in /assets/)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    access_log /var/log/nginx/amphitheater.access.log;
    error_log  /var/log/nginx/amphitheater.error.log;
}
NGINX
```

Enable it and reload nginx:
```bash
ssh oracle-1 '
  sudo ln -sf /etc/nginx/sites-available/amphitheater.pashteto.com /etc/nginx/sites-enabled/ &&
  sudo nginx -t &&
  sudo systemctl reload nginx
'
```

`nginx -t` validates syntax before reload — if it fails, fix the file and re-run; nginx won't pick up a broken config.

Smoke test HTTP (still no cert at this point):
```bash
curl -I http://amphitheater.pashteto.com/
# expect: HTTP/1.1 200 OK, content-type: text/html
```

### 5b. Issue the Let's Encrypt cert

```bash
ssh oracle-1 'sudo certbot --nginx -d amphitheater.pashteto.com --non-interactive --agree-tos -m pavel.dodonov@gateway.fm --redirect'
```

What `--nginx` does: certbot edits the vhost in place — adds the `listen 443 ssl` block, `ssl_certificate`/`ssl_certificate_key` lines, and (because of `--redirect`) replaces the HTTP server with a 301 to HTTPS. Same shape as the existing `vpn.pashteto.com` config.

If you'd rather not let certbot edit nginx, use `certonly` and write the HTTPS server block by hand — but `--nginx` is the path of least resistance and matches what's already deployed here.

Auto-renewal: certbot installs a systemd timer; no manual cron needed.

Final smoke test:
```bash
curl -I https://amphitheater.pashteto.com/
# expect: HTTP/2 200, content-type: text/html
curl -I http://amphitheater.pashteto.com/
# expect: HTTP/1.1 301 Moved Permanently → https://amphitheater.pashteto.com/
```

Open <https://amphitheater.pashteto.com/> in a browser — relief base + longread should render exactly like the GH Pages version.

---

## 6. Self-host the tile pyramid on oracle-1 (post-initial-deploy)

After step 5 the site works but fetches relief tiles cross-origin from `pashteto.github.io/gavr-tiles`. Moving tiles to oracle-1 itself removes the external dependency.

```bash
# 1) Upload the tile pyramid (15,719 PNGs, ~236 MB)
cd /Users/dodonovpavel/gavr_mounty/gavr_mounty
rsync -az \
  tile-build/tiles/relief/{10,11,12,13,14} \
  oracle-1:/var/www/amphitheater.pashteto.com/html/tiles/relief/

# 2) Fix perms — macOS rsync (openrsync) preserves source 0600, nginx needs 0644
ssh oracle-1 '
  find /var/www/amphitheater.pashteto.com/html/tiles -type d -exec chmod 755 {} +
  find /var/www/amphitheater.pashteto.com/html/tiles -type f -exec chmod 644 {} +
'

# 3) Add the /tiles/ cache + ACAO block to the nginx vhost
#    Insert this inside the `server { ... listen 443 ssl; ...}` block,
#    after the existing `location /assets/ { ... }` block:
#
#    location /tiles/ {
#        expires 1y;
#        add_header Cache-Control "public, immutable";
#        add_header Access-Control-Allow-Origin "*";
#    }
#
#    Then:
ssh oracle-1 'sudo nginx -t && sudo systemctl reload nginx'

# 4) Re-build the app with same-origin tile URL and re-sync (excluding /tiles/)
cd /Users/dodonovpavel/gavr_mounty/gavr_mounty/Map-View-Client
VITE_TILE_BASE_URL=/tiles VITE_BASE_PATH=/ npm run build
rsync -avz --delete --exclude='/tiles/' dist/ oracle-1:/var/www/amphitheater.pashteto.com/html/

# 5) Smoke test the tile origin
curl -sS -I https://amphitheater.pashteto.com/tiles/relief/10/599/297.png | head -7
# expect: HTTP/2 200, content-type: image/png, cache-control: public, immutable
```

Why bother:
- Zero external runtime dependencies for map rendering. Site keeps working even if GitHub Pages is degraded.
- Same-origin requests skip a DNS lookup and a TLS handshake; small latency win on first tile.

Why this might *not* be worth it later:
- 236 MB more on oracle-1 disk (45 GB total, 35 GB free — fine).
- Outbound bandwidth from oracle-1 instead of GitHub's CDN. Oracle Cloud free tier allows 10 TB/month; at ~15 KB/tile and ~50 tiles per session that's ~133 K sessions/month — comfortably above any realistic traffic for this longread.

## 7. Re-deploys

After initial setup + tile self-host, two flows. Most edits are app-only:

### App only (most common)
```bash
cd /Users/dodonovpavel/gavr_mounty/gavr_mounty/Map-View-Client
VITE_TILE_BASE_URL=/tiles VITE_BASE_PATH=/ npm run build
rsync -avz --delete --exclude='/tiles/' dist/ oracle-1:/var/www/amphitheater.pashteto.com/html/
```

The `--exclude='/tiles/'` (note the leading slash — anchors to top of transfer) preserves the existing tile pyramid even with `--delete`.

### Tile pyramid only (rare — re-tiling, new zoom level, hillshade)
```bash
cd /Users/dodonovpavel/gavr_mounty/gavr_mounty
rsync -az tile-build/tiles/relief/{10,11,12,13,14} \
  oracle-1:/var/www/amphitheater.pashteto.com/html/tiles/relief/
ssh oracle-1 'find /var/www/amphitheater.pashteto.com/html/tiles -type f -exec chmod 644 {} +'
```

No nginx reload needed for content changes — only when the vhost itself is edited.

If you want one-liner scripts, drop these into `Map-View-Client/scripts/`:

```bash
# deploy-oracle-1.sh — app only
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VITE_TILE_BASE_URL=/tiles VITE_BASE_PATH=/ npm run build
rsync -avz --delete --exclude='/tiles/' dist/ \
  oracle-1:/var/www/amphitheater.pashteto.com/html/
echo "Deployed → https://amphitheater.pashteto.com/"
```

---

## 8. Rollback

If a deploy breaks the site, the fastest fix is to push the previous `dist/` back:

```bash
# Keep a tagged backup before a risky deploy:
ssh oracle-1 'sudo cp -a /var/www/amphitheater.pashteto.com/html /var/www/amphitheater.pashteto.com/html.bak'

# Restore:
ssh oracle-1 'sudo rsync -a --delete /var/www/amphitheater.pashteto.com/html.bak/ /var/www/amphitheater.pashteto.com/html/'
```

The site itself doesn't have a database or runtime state — rolling back is just file replacement.

---

## 9. Common pitfalls

- **Cert challenge fails** — DNS hasn't propagated. `dig +short amphitheater.pashteto.com` must return `129.146.183.89` from the server's view (`ssh oracle-1 dig +short amphitheater.pashteto.com`) before running certbot.
- **404 on deep links** — SPA fallback (`try_files ... /index.html`) is missing from the vhost. Step 5a includes it; double-check it survived certbot's rewrite.
- **Tiles don't load** — first check the bundle: if `pashteto.github.io/gavr-tiles` is baked in (default), make sure CORS-fetched tiles resolve. If `/tiles/...` is baked in (post-step-6 setup), check that the tile files exist on disk *and* are mode `0644`; macOS rsync preserves the `0600` mode that gdal2tiles writes, which causes silent 403s. Fix with the `find -exec chmod` shown in step 6.
- **macOS `rsync` is openrsync (BSD)** — doesn't support `--info=progress2`, `--info=stats`, and some other GNU flags. Use plain `-az`/`-avz` or `brew install rsync` for GNU rsync.
- **`--delete` with tiles in the same docroot** — vanilla `rsync -av --delete dist/ ...` would wipe `/tiles/` when re-deploying the app. Always use `--exclude='/tiles/'` (leading slash anchors to transfer root).
- **Sheets API CORS** — the Google Sheets API key has an HTTP-referrer restriction. Adding `amphitheater.pashteto.com` to the allowed referrers in the Google Cloud Console is required before the longread copy will load from the sheet on this domain. Until then, the app silently falls back to `fallbackContentItems` in `MainMap.tsx`.
- **Mixed-content on HTTPS** — none expected; tile URL is HTTPS, sheet URL is HTTPS, no other external resources.

---

## 10. What this does *not* do

- Doesn't touch `mypass.pashteto.com` or `vpn.pashteto.com` vhosts.
- Doesn't change the GitHub Pages deploy of `Map-View-Client` — that workflow keeps working with `base=/Map-View-Client/` and fetches tiles cross-origin from `pashteto.github.io/gavr-tiles`. The two deployments now diverge in tile origin.
- Doesn't remove the `Pashteto/gavr-tiles` repo. Kept as the source-of-truth for the tile pyramid and as the tile origin for the GH Pages mirror.
- Doesn't set up CI for the new domain; deploys are manual rsync from your laptop. Add a GitHub Actions job later if you want push-to-deploy.
