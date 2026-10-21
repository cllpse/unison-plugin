<img width="1920" height="1080" alt="Product" src="https://github.com/user-attachments/assets/410815d5-0f55-4c12-a76f-cbd567628af7" />

# unison-plugin

Figma plugin that turns the selected frame into React Native component code for
[unison-components](https://github.com/cllpse/unison-components), and lists what in the design can't be expressed with
its tokens yet. It also imports design tokens into Figma as variables, text styles and shadow styles.

Part of [Unison](https://github.com/cllpse/unison), alongside
[unison-components](https://github.com/cllpse/unison-components),
[unison-playground-web](https://github.com/cllpse/unison-playground-web),
[unison-playground-expo](https://github.com/cllpse/unison-playground-expo) and
[unison-website](https://github.com/cllpse/unison-website).

## Development

- `bun run plugin:build` - build into `dist/`, then import `dist/manifest.json` in Figma
- `bun run plugin:watch` - rebuild on every change in `src/`
- `bun run lint` / `bun run format` / `bun run typecheck`
