<img width="300" height="491" alt="Plugin" src="https://github.com/user-attachments/assets/84b953f0-6ea8-42f0-a989-0646f1e7a3dc" />

# unison-plugin

Figma plugin that turns the selected frame into React Native component code for
[unison-components](https://github.com/cllpse/unison-components), and lists what in the design can't be expressed with
its tokens yet. It also imports design tokens into Figma as variables, text styles and shadow styles.

Part of [Unison](https://github.com/cllpse/unison), alongside
[unison-components](https://github.com/cllpse/unison-components),
[unison-playground-web](https://github.com/cllpse/unison-playground-web),
[unison-playground-expo](https://github.com/cllpse/unison-playground-expo) and
[unison-website](https://github.com/cllpse/unison-website).

## Install from the manifest

The plugin is in review for the Figma Community. Until it's listed there, install it from this repository's manifest.
Figma only imports plugins from a manifest in its desktop app, not in the browser.

1. Get the repository: clone it with `git clone https://github.com/cllpse/unison-plugin`, or download it as a ZIP from
   the green **Code** button on GitHub and unzip it. The built plugin is checked in under `dist/`, so there's nothing to
   build or install.
2. In the Figma desktop app, open a design file and pick **Plugins > Development > Import plugin from manifest...** from
   the main menu, or right-click the canvas for the same menu.
3. Select `dist/manifest.json` in the repository. The one in `src/` isn't the built plugin.
4. Run it from **Plugins > Development > Unison**. It also runs in Dev Mode.

Figma loads the plugin from those files every time it runs, so keep the folder where it is. To update, run `git pull`
in it, or download the ZIP again and unzip it over the same folder.

## Development

- `bun run plugin:build` - build into `dist/`, then import `dist/manifest.json` in Figma
- `bun run plugin:watch` - rebuild on every change in `src/`
- `bun run lint` / `bun run format` / `bun run typecheck`
