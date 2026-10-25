# Host on Render

The repository includes `render.yaml` for a free Node web service. It uses Render's assigned PORT, binds to all interfaces, checks `/healthz`, and waits for passing GitHub checks before automatic deployments. No database or paid service is declared.

1. Open https://dashboard.render.com/select-repo?type=blueprint and select `tarun-vignes/tampa-taste-trail`. If needed, connect GitHub and grant access to this repository.
2. Set Blueprint Name to `tampa-taste-trail`, Branch to `main`, and Blueprint Path to `render.yaml`.
3. Review the single free web service, then click **Deploy Blueprint**.
4. Open the created service and wait until its deployment says **Live**. Use the actual URL shown by Render; no URL is guaranteed in advance.
5. In the service's **Environment → Edit → Add variable**, add `GEMINI_API_KEY` with your private Gemini key and `QLOO_API_KEY` with your issued Qloo key. Confirm `QLOO_BASE_URL` matches the exact host authorized by your Qloo issuer; edit it if required. Save and redeploy. Keys from your computer do not transfer automatically.
6. Open the public URL anonymously, parse a request, confirm actual Qloo signals, build a real trail, and check replacement options and provenance. `/api/status` shows credential availability only; a configured key alone does not verify provider access.

The Blueprint initially enables the explicitly labeled fictional preview so visitors can explore the interface before Qloo access is configured. It never substitutes fixtures for failed live calls. Rule extraction is labeled when Gemini is absent. After live Qloo verification, change `ALLOW_FIXTURE_DEMO` to `"false"` in `render.yaml` and push it to hide preview mode for judges.

The app automatically uses `RENDER_EXTERNAL_URL` for its canonical origin. For a custom domain, set `APP_ORIGIN` to the exact HTTPS origin without a trailing slash and redeploy. Keep provider keys in Render Environment, never the repository or browser code.

Render's free web services can spin down when idle, so the first visit may take longer. See [Render free service limits](https://render.com/docs/free). This file prepares deployment; it is not evidence that a service is already live. Record and verify the actual assigned URL after deploying.
