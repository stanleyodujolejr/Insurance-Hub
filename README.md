# Insurance-Hub

Static study pages for life and health licensing practice.

**Published from `main` today:** Virginia and Maryland exam pages, linked from `index.html`. Progress stays in the browser until a student turns on auto-send. The Apps Script those pages post to is in `apps-script/live/`. Pushes to `main` that change that folder deploy it. One-time setup is in `DEPLOY.md`.

**This branch, not the published site until it is merged and the Pages site is updated:** Georgia practice for Pearson VUE 12-GA-01, 12-GA-02, and 12-GA-05. Sources, weights, and what was not verified are in `GEORGIA_SOURCES.md`. Georgia opt-in progress send is live (`GA_SYNC_LIVE` is true). After a student turns it on, the page posts to the same web app as Maryland and Virginia, with `state` `GA`. See `APPS_SCRIPT_GA_SETUP.md`.

`STUDY_PLAN.md` is the Maryland and Virginia study handoff. It is not a Georgia plan.
