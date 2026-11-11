# Linux's raw file repository

A personal repository for text, source snippets and binary downloads. The files
inside `public/` go directly to Vercel's static output. For private downloads,
one small Node.js Vercel Function checks a bearer token and streams data from a
private Vercel Blob store. There is no frontend, database or account system.

A purely static deployment works for public files. Per-file private access on the
same hostname needs server-side authorization. The Vercel Function supplies that
check without adding Next.js. Use the public URLs in this guide only after you
confirm the actual production alias in Vercel.

## Repository layout

```text
api/private.mjs          Vercel Function wired to a private Blob store
lib/private-download.mjs   Token verification and raw download responses
public/
  context.txt            Plain-text index, also served at /
  projects.txt
  data.json
  config/settings.json
  projects/research.md
  examples/              YAML, CSV, shell, log and ZIP examples
  linux/                 LVM, NFS, AutoFS, users and groups lab answers
test/                    Download-handler tests with simulated Blob storage
vercel.json              Static directory, response headers and private routing
```

Only `public/` is published as static files. Both `/api/` and `/private/` are
reserved for routing. Use lowercase file extensions for the explicit text
content-type rules. Vercel infers the usual types for PDF, PNG, JPEG, ZIP and
other static formats. Unknown types can be added to the relevant header rule.
Public examples are safe to share, including the example configuration files.

## Deploy once from the CLI

1. Install Node.js 22 and the current Vercel CLI. Private Blob CLI commands
   require at least Vercel CLI 50.20.0. Run these in the project directory.

   ```bash
   npm install
   npm test
   npx vercel@latest login
   npx vercel@latest --prod
   ```

2. When prompted, choose your personal Vercel scope and create a fresh project
   named `Linuxisadev`. Keep the current directory as project root and the
   checked-in build settings. Framework Preset is Other and Output Directory is
   `public`. Use the Production domain shown in the deployment output or under
   **Settings → Domains**. If the preferred alias is taken, use the assigned one.
3. Verify that the production domain serves public files without login. Preview
   domains may have deployment protection. Use the production alias in scripts.

   ```bash
   BASE=https://Linuxisadev.vercel.app
   curl -fsSL "$BASE/context.txt"
   curl -fsSL "$BASE/context.txt" | cat
   curl -fsSL "$BASE/projects.txt" -o projects.txt
   curl -fsSL "$BASE/data.json"
   curl -fsSL "$BASE/config/settings.json"
   curl -fsSL "$BASE/linux/lvm.md" -o lvm.md
   curl -fsSI "$BASE/linux/lvm.md"
   curl -fsSL "$BASE/examples/sample.zip" -o sample.zip
   unzip -t sample.zip
   ```

   For a redirect check, run `curl -sSI "$BASE/context.txt"` and expect HTTP
   200, no Location header and `text/plain; charset=utf-8`.

## Enable GitHub updates

Create an empty repository on GitHub. It can be private while the site still
serves its public files. If the directory is new to Git, initialize it and push.

```bash
git init -b main
git add .
git commit -m "Create raw file repository and Linux labs"
git remote add origin https://github.com/YOUR_USERNAME/Linuxisadev.git
git push -u origin main
```

On the existing Vercel project, open **Settings → Git** and connect the GitHub
repository. If you prefer to start from GitHub, import the repository as a fresh
project from the Vercel dashboard instead of first creating one via the CLI.
Confirm that `main` is the production branch. Subsequent pushes to that branch
trigger production deployments automatically. Use GitHub's web upload and commit
flow for public files when you are away from your computer. Add or replace
files under `public/` and commit the changes. For example, commit
`public/projects/research.md` to update `/projects/research.md`.

## Enable private downloads

1. In the Vercel project, create a **Private Blob** store in **Storage** and
   connect it to Production. Vercel adds `BLOB_READ_WRITE_TOKEN` for the project.
   Use a dedicated store for this repository.
2. Generate a strong download secret with `openssl rand -hex 32`. Add the
   generated value as `PRIVATE_READ_TOKEN` under the project's Production
   environment variables. Redeploy once for the new environment variables to take
   effect, using `npx vercel@latest --prod` or **Redeploy** in the dashboard.
3. Keep the private file outside `public/` and outside the Git checkout. From
   the linked checkout, upload with the current Vercel CLI. If you imported via
   GitHub, first run `npx vercel@latest link` and select the existing project.
   If your CLI asks for a Blob token, use the linked private store's
   `BLOB_READ_WRITE_TOKEN` in your local environment and unset it afterward.

   ```bash
   npx vercel@latest blob put ~/Documents/notes.md \
     --access private --pathname notes/notes.md
   ```

   To update the same URL, run the same command with `--force`. Upload and
   overwrite operations take effect independently of a Vercel deployment.
   Use keys like `notes/notes.md`, with ASCII letters, digits, dots, hyphens
   and underscores, starting each path segment with a letter or digit.
4. Check both access modes. The first command should report `401`. For the
   second, load `PRIVATE_READ_TOKEN` into your local shell from your password
   manager. A header supplied on stdin keeps the expanded token out of curl's
   process arguments.

   ```bash
   BASE=https://Linuxisadev.vercel.app
   curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/private/notes/notes.md"
   printf 'Authorization: Bearer %s\n' "${PRIVATE_READ_TOKEN:?Set PRIVATE_READ_TOKEN first}" |
     curl -fsS -H @- "$BASE/private/notes/notes.md" -o notes.md
   ```

   Private downloads return raw bytes, with the content type recorded in Blob.
   The CLI normally infers it from the filename. The private endpoint also
   supports HEAD. To download a private PDF, image or archive, change the path and
   the `-o` filename. Test unusually large private downloads against Vercel's
   current Function streaming limits and project quotas.

## Access and cost

- Assume everything committed under `public/` is public, including older
  deployments and Git history. Review configs, logs, archives and binaries for
  secrets before committing.
- The shared download secret grants read access to every key in this dedicated
  private store. It grants no upload permission. Upload and overwrite access
  stays with your authenticated Vercel account or Blob read/write token.
- Use HTTPS and send the download secret only as an Authorization header. Keep
  credentials out of repository files, URLs and logs. Rotate the download secret
  and redeploy if it leaks. Review and retire older deployments that may still
  contain the previous environment value.
- The private handler fails closed if its secret is absent or invalid. Private
  responses use `Cache-Control: private, no-store`. Blob reads bypass the Blob
  cache so that overwrites are visible immediately. This can add origin transfer
  usage. Public reads use Vercel's static delivery and need no Function calls.
- Keep the Blob store optional if you only need the public lab files. Review
  Vercel's current usage limits before hosting large or high-traffic files.

## Local checks

Run `npm test` to test the private handler with simulated storage. For the full
Vercel routing stack, sign in, link the project and run `npx vercel@latest dev`.
For a linked Blob store, configure Development separately and use test data.
Run the Linux commands on disposable Linux VMs as described in each lab.

## References

- [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github)
- [Vercel private Blob storage](https://vercel.com/docs/vercel-blob/private-storage)
- [Vercel Blob CLI](https://vercel.com/docs/vercel-blob/manage-blob-storage)
