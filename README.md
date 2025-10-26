# Eons Dev Launcher

**Eons Dev Launcher** is a lightweight browser extension that injects an **"Open"** button on GitHub, GitLab, and [git.infrastructure.tech](https://git.infrastructure.tech) repository pages. Clicking this button launches the current repository in a **workspace environment** such as **Kasm** or **Coder**.

For Kasm:

```
https://workspace.infrastructure.tech/#/cast/dev?kasm_url=<CURRENT_REPO_URL>
```

For Coder:

```
https://coder.example.com/templates/devcontainer/workspace?param.repo_url=<CURRENT_REPO_URL>
```

Originally forked from [Gitpod's browser extension](https://github.com/gitpod-io/browser-extension) and rebuilt for cross-platform compatibility (Linux, macOS, Windows) and modern build tooling.

## Features

* Adds an **"Open"** button on GitHub, GitLab, and git.infrastructure.tech repositories
* Opens the repo in a dev workspace platform like **Kasm** or **Coder** with a single click
* Works seamlessly on **Chrome** and **Firefox**
* Lightweight—no tracking, no telemetry, no accounts required
* Fully open-source under the MIT license

## Development Setup

### 1. Clone the repository

```bash
git clone https://git.infrastructure.tech/eons/ext/browser/dev.workspace.git
cd dev.workspace
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build for your target browser

You can build both versions or just one, depending on your needs.

All builds output to the same `eons-dev-launcher/` folder.

It is recommended to clean the output folder between builds if switching browsers.

#### Chrome build

```bash
pnpm run build:chrome
```

#### Firefox build

```bash
pnpm run build:firefox
```

The Firefox build automatically injects the required `"browser_specific_settings"` → `gecko.id` block for AMO signing and installs.

## Loading the Extension (Development Mode)

### Chrome / Chromium / Edge

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `eons-dev-launcher/` folder
5. The "Eons Dev Launcher" icon will appear in your toolbar.


### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` inside the `eons-dev-launcher/` folder
4. The extension will appear in your toolbar for this session.

Note: Temporary add-ons are removed when Firefox restarts.


## How It Works

The extension injects a lightweight content script that:

1. Detects when you’re viewing a supported repository (GitHub, GitLab, or git.infrastructure.tech)
2. Injects an **"Open"** button near the repo title or toolbar
3. When clicked, it opens one of the following, depending on configuration:

   * Kasm: `https://workspace.infrastructure.tech/#/cast/dev?kasm_url=<CURRENT_REPO_URL>`
   * Coder: `https://coder.example.com/templates/devcontainer/workspace?param.repo_url=<CURRENT_REPO_URL>`


## Customization

You can configure the base workspace URL if you host your own environment.

### Change the base URL

1. Open the extension’s **Options** page:

   * **Chrome:** `chrome://extensions` → **Eons Dev Launcher** → **Details** → **Extension options**

   ![Chrome Extension Options](./doc/asset/chrome-options.png)

   * **Firefox:** Right-click the extension icon → **Manage Extension** → kebab → **Preferences**

   ![Firefox Extension Options](./doc/asset/firefox-options.png)

2. Enter a custom workspace base URL, for example:

   ```
   https://workspace.infrastructure.tech/#/cast/dev?kasm_url=
   ```

   or for Coder:

   ```
   https://coder.example.com/templates/devcontainer/workspace?param.repo_url=
   ```

   ![Settings Page](./doc/asset/settings-page.png)

3. Save changes—the button will now open your custom environment.


## License

MIT © [Eons LLC](https://infrastructure.tech)
