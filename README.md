# Lantern Tales

AI text adventures with community worlds from AI Dungeon, Questner, OOC and Voyage. You get sandbox freedom (Do, Say, Story, OOC, edit, retry, undo, story cards, memory, AI Dungeon scripts) with Voyage-style depth: character creation, skills and abilities, dice, places, people and quests. The narrator runs on [OpenRouter](https://openrouter.ai) with your own key.

## Install

**iPhone or iPad:** open **https://prxphet-ai.github.io/lantern-tales/** in Safari, tap Share › **Add to Home Screen**, then open Lantern Tales from your home screen.

**Android:** open the same link in Chrome, then menu › **Install app**.

**Windows, Mac or Linux:** download the zip for your computer from [Releases](../../releases/latest), unzip it, and run **Lantern Tales**.
- Windows: if SmartScreen warns you, click *More info › Run anyway* (the program isn't code-signed).
- Mac: the first time, right-click the app › **Open** › Open (it isn't notarized by Apple).

You can also install the web app on a computer: open the link in Chrome or Edge and click the install icon in the address bar.

## First start

1. Make an account at [openrouter.ai](https://openrouter.ai) and add a few dollars of credit, or use the free models.
2. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys) and paste it into the welcome screen.
3. Pick models: Claude for the best writing, DeepSeek for cheap, or Free. Change them any time in Panel › Settings › AI connection.

Your key is saved only on your device and is sent only to OpenRouter.

## Building

`npm ci`, then `npm start` to run the desktop program, or `npm run pack -- win32 x64` to package it. Pushing a `v*` tag builds every platform and publishes a release. The web app is the `www/` folder, published to GitHub Pages from the `gh-pages` branch.
