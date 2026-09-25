# vibeOnly (VibeSong)

A free, ad-free, no-login music app in the style of Spotify. It runs entirely in the browser and uses only free, keyless music sources.

## Music sources

| Source | What you get | Notes |
| --- | --- | --- |
| [Audius](https://audius.co) | Full-length songs, artists, playlists, albums | Powers Trending, 40+ genres, Made For You, Autoplay and artist pages |
| iTunes Search | 30-second previews | Mainstream Bollywood, Punjabi, Tamil, Telugu, K-Pop, Arabic and more, labelled **PREVIEW** |
| Internet Archive | Full songs | Public-domain recordings, including 78rpm-era classics |
| Radio Browser | Live radio | HTTPS, non-HLS stations only, labelled **LIVE**. Covers India, Nepal, news, lo-fi, jazz and more |
| [LRCLIB](https://lrclib.net) | Synced lyrics | Shown in the full-screen player |
| Your Supabase uploads (optional) | Full songs | Add your URL and anon key in `src/app/core/environment.ts` to enable uploads and `/admin` |

No setup is needed: `npm install && npm start`.

## Features

- **Browse:** 79 categories across genres, languages and regions, moods and live radio
- **Search:** top result, songs, artists, playlists and albums, previews and radio, plus recent searches
- **Artist pages:** popular songs, bio, follower count, and Follow
- **Public playlists and albums:** play, shuffle, queue, or "Save to library"
- **Your library:** Liked Songs (filter and sort), playlists (create, rename, reorder, suggestions), followed artists, stats (top artists, On Repeat), and backup export/import as JSON
- **Player:** auto-skip broken songs, Autoplay similar songs, Up Next queue editing, synced lyrics, sleep timer, shuffle and repeat, lock-screen controls, and resume after reload
- **Keyboard shortcuts:** Space play/pause, ←/→ seek, Shift+←/→ previous/next, ↑/↓ volume, S shuffle, R repeat, L like, M mute

Everything personal is stored in your browser's localStorage. There are no accounts and no tracking.

## Publish it (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds the app and deploys it on every push to `clean-Web-React`.
One-time setup: **Settings → Pages → Source: GitHub Actions**. The site is then live at `https://<user>.github.io/vibeSong/`.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
