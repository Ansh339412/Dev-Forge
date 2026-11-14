# Free-tier hosting

The GitHub Pages site can use a separately hosted API. `render.yaml` defines a
free Render web service for the NestJS backend. Free Render services can sleep
after inactivity and are intended for hobby/testing use, not production.

The API also needs:

- PostgreSQL: Neon Free or another free PostgreSQL provider.
- Redis: Upstash Free or another Redis-compatible provider.
- Email: Gmail SMTP is configured in the Render Blueprint. Use a Google
  App Password (requires 2-Step Verification) and the same Gmail address for
  `SMTP_USER` and `MAIL_FROM`. Do not use the normal Google account password.

The current Render Blueprint disables attachment uploads to avoid a metered
object-storage subscription. The rest of the application does not require file
storage.

Create the required services in their provider dashboards and keep their
credentials private. When deploying the Render Blueprint, enter the database
URL, Redis URL, Gmail address for `SMTP_USER` and `MAIL_FROM`, and Google App
Password for `SMTP_PASS`. Remove `RESEND_API_KEY` from the Render environment
so the backend uses SMTP. Never put credentials in the repository or GitHub
Pages variables.

After the Render API is healthy:

1. Copy its base URL (for example, `https://devforge-api.onrender.com/api/v1`).
2. In the repository settings, add the Actions variable `VITE_API_URL` with that
   URL.
3. Rerun the **Deploy to GitHub Pages** workflow.

The API's `CORS_ORIGIN` and `APP_URL` are already set in `render.yaml` for the
current GitHub Pages site. If the repository owner/name changes, update them.
Check each provider's current quota and data-retention policies before using
free tiers; free-tier availability and limits can change.
