# Free-tier hosting

The GitHub Pages site can use a separately hosted API. `render.yaml` defines a
free Render web service for the NestJS backend. Free Render services can sleep
after inactivity and are intended for hobby/testing use, not production.

The API also needs:

- PostgreSQL: Neon Free or another free PostgreSQL provider.
- Redis: Upstash Free or another Redis-compatible provider.
- S3-compatible file storage: Cloudflare R2 free allowance. Create a private
  bucket and an API token limited to that bucket.
- Email: Resend requires a verified sender/domain before registration,
  verification, password reset, and invitation emails can be delivered.

Create these services in their provider dashboards and keep their credentials
private. When deploying the Render Blueprint, enter the database URL, Redis URL,
Resend sender and key, and R2 bucket, endpoint, and credentials as prompted.
Never put credentials in the repository or GitHub Pages variables.

After the Render API is healthy:

1. Copy its base URL (for example, `https://devforge-api.onrender.com/api/v1`).
2. In the repository settings, add the Actions variable `VITE_API_URL` with that
   URL.
3. Rerun the **Deploy to GitHub Pages** workflow.

The API's `CORS_ORIGIN` and `APP_URL` are already set in `render.yaml` for the
current GitHub Pages site. If the repository owner/name changes, update them.
Check each provider's current quota and data-retention policies before using
free tiers; free-tier availability and limits can change.
