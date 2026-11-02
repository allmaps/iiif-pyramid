# Allmaps IIIF Pyramid

Explore large IIIF images as an interactive tile pyramid, or find tiles in
**Allmaps IIIF Tile Hunt**. Built with SvelteKit, TypeScript, Tailwind CSS, MapLibre and
Allmaps. Everything runs in the browser.

## Development

Requires Node 24+ and pnpm 10.

```sh
pnpm install
pnpm dev
```

Open [localhost:5173](http://127.0.0.1:5173). Choose an example or paste a IIIF
image service, manifest, or Content State.

```sh
pnpm check
pnpm test
pnpm build
pnpm preview
```

## Documentation

- [Using the explorer](docs/usage.md)
- [Tile Hunt and controller support](docs/game.md)
- [IIIF manifests and Content State](docs/iiif.md)
- [Embedding](docs/embedding.md)
- [Rendering and architecture](docs/architecture.md)
- [Position figures](docs/figures.md)
- [Deployment and GitHub Pages](docs/deployment.md)

Made by Jules Schoonman and based on his earlier
[IIIF tile pyramid notebook](https://observablehq.com/@allmaps/tile-pyramid).
