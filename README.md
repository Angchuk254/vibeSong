# VibeSong

A personal Spotify-style player.

## Music sources

| Source | What you get | Notes |
| --- | --- | --- |
| Your Supabase uploads | Full songs | Uploaded through `/admin/upload` |
| [Audius](https://audius.co) | Full-length songs | Free, no API key. Powers Trending, genre rows, Made For You, and Autoplay |
| iTunes Search | 30-second previews | Mainstream Bollywood, Punjabi and Nepali catalog, labelled **PREVIEW** |
| Internet Archive | Full songs | Public-domain recordings |
| Radio Browser | Live radio | Only HTTPS, non-HLS stations that passed their last check, labelled **LIVE** |

## Setup

Copy `src/app/core/environment.example.ts` to `src/app/core/environment.ts` and add your Supabase URL and anon key. The real file is git-ignored.

## Player features

- Broken or slow songs are skipped automatically
- Autoplay: when the queue ends, similar songs keep playing
- Up Next queue: play next, add to queue, reorder, remove
- Playlists, Liked Songs, listening stats (top artists, On Repeat)
- Sleep timer, lock-screen and headphone controls, and resume after reload
- Keyboard shortcuts: Space play/pause, ←/→ seek, Shift+←/→ previous/next, ↑/↓ volume, S shuffle, R repeat, L like, M mute

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
