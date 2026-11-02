# Deployment

## GitHub Pages

The [Pages workflow](../.github/workflows/pages.yml) checks, tests, builds and
deploys the app on pushes to `main`. It can also be run manually from Actions.

1. Push this project to a GitHub repository.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
3. Push to `main`, or run **Deploy to GitHub Pages** from the Actions tab.

The workflow uses GitHub's Pages actions and the built-in token. It reads the
site's base path from `configure-pages`, supporting both repository URLs such as
`https://user.github.io/pyramid/` and sites served at the domain root. If the
repository uses another default branch, update the workflow's branch filter.

The deploy job uses the `github-pages` environment. Any deployment protection
rules configured on that environment still apply.

Reference: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Other static hosts

Run `pnpm build` and serve `build/` over HTTPS (localhost also works). The
explorer, `/game/`, `/embed/`, and `/figures/` have prerendered HTML entry points;
the interactive app starts in the browser. `404.html` is the SPA fallback for
hosts that support it. No backend or deployed image proxy is needed.

For a subdirectory deployment, set the base path without a trailing slash:

```sh
BASE_PATH=/pyramid pnpm build
BASE_PATH=/pyramid pnpm preview
```

Open `/pyramid/` in the preview. The service worker, virtual IIIF endpoints,
navigation links and generated embed links all stay within this base path.
Build without `BASE_PATH` to return to root hosting. Allow iframe embedding if
using the embed route; image services must allow cross-origin browser requests.

[Back to README](../README.md)
