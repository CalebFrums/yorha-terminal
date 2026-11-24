# YoRHa Terminal

A fan-made NieR:Automata style desktop terminal for [Wallpaper Engine](https://store.steampowered.com/app/431960/Wallpaper_Engine/). It is plain HTML, CSS and canvas, with no game assets.

![YoRHa Terminal preview](preview.gif)

**[Try the live demo](https://calebfrums.github.io/yorha-terminal/)** · **[Subscribe on the Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3830732662)** · **[Download YoRHaHelper.zip](https://github.com/CalebFrums/yorha-terminal/raw/main/YoRHaHelper.zip)** (optional, [what it is](#yorha-helper-optional))

> Not affiliated with Square Enix. NieR:Automata and its characters belong to their owners.

## The hub and its places

The desktop is the hub. Hover a menu entry to preview it and click to go there. HUB brings you back, and the terminal also returns on its own when idle.

| Place | What's there |
| --- | --- |
| **MAP** | Drag the globe and click locations to survey them |
| **QUESTS** | Time progress, your own daily orders checklist, a calendar with alerts, a weekly schedule, a focus timer, and optional wellness reminders |
| **INTEL** | Now playing with music buttons, an audio log and the Pod archive |
| **ARCHIVE** | A character grid. Click a record to put it on the desktop, or set it as your unit |
| **UNIT** | Look after your character, Tamagotchi style. Bond unlocks accessories; outfits switch freely |
| **HACKING** | BREACH, a 3D intrusion drill built on three.js. Also INTERCEPT, LOGIC LOCK and your records |
| **GARDEN** | Plant Lunar Tears and stir the wind with the cursor |
| **SYSTEM** | Diagnostics and quick settings you can change from the desktop |

## Features

- A live clock and date in the YoRHa menu style
- An audio visualizer and floating particles, with scanlines and glitches. A sensitivity setting and an auto-boost make quiet music show up too
- A Pod log with about 210 lines that react to the time, the music and what you do (try petting the Pod: move in slow circles over its log)
- Daylight, night or automatic theme, which switches by the clock
- Menu on the left or right. It works on ultrawide and portrait monitors
- Your own image or `.webm` video as a duotone background
- Characters from a folder of your PNGs. They stand beside the panel, breathe, emote, say your custom lines and react to clicks
- UNIT: care for one character. Integrity, energy and morale drift down in real time; repairs, sleep mode, pats and Lunar Tears from the GARDEN bring them back. Bond unlocks accessories from the game (Pink and Blue Ribbon, Lunar Tear, Fox Mask, Machine Head, Emil's Head), drawn here as simple originals. WARDROBE also switches between outfits: any images that share the unit's name
- WELLNESS: optional Pod proposals to rest your eyes (20-20-20), drink water, stretch, check your posture and eat at your meal times
- CALENDAR: a month view for birthdays, appointments and reminders, with repeats (weekly, monthly, yearly) and alerts (at the time, 10 min, 1 hour or 1 day before). Alerts show above the hub panel with a soft chime and wait until you acknowledge or snooze them
- WEEKLY SCHEDULE: a timetable of your week. Click an empty slot to add an activity; a line marks the current time
- A desktop agenda above the hub panel (never over the character): this week, what is on now, what is next and coming entries. It shows when something is planned, always, or never
- Titles are typed on an on-screen keyboard (Latin, accents, Cyrillic, kana, symbols), because Wallpaper Engine sends no key presses to wallpapers. With YoRHa Helper you can use your real keyboard
- 9 languages: English, 简体中文, 日本語, 한국어, Русский, Deutsch, Français, Español, Português (Brasil)

## YoRHa Helper (optional)

Wallpaper Engine lets a wallpaper see what is playing but not control it, and it sends wallpapers no key presses. [`helper/`](helper) fills both gaps on your own PC:

- **Music buttons**: INTEL's previous, play/pause and next press the Windows media keys, so Spotify, browsers and most players respond
- **Real keyboard typing**: TYPE ON PC KEYBOARD in the calendar and schedule editors opens a small text box. You type there with your own keyboard, and input methods for Chinese, Japanese and Korean work too. It never reads keys typed anywhere else

**Setup** (the same steps are inside the wallpaper under SYSTEM > YORHA HELPER):

1. **[Download YoRHaHelper.zip](https://github.com/CalebFrums/yorha-terminal/raw/main/YoRHaHelper.zip)** and unzip it into a folder you will keep, such as Documents.
2. Double-click `Install-YoRHaHelper.cmd`. If Windows asks, choose **Run** (or **More info**, then **Run anyway**): the file came from the internet. It starts now and with Windows.
3. In the wallpaper, open **SYSTEM > YORHA HELPER** and press **SWITCH ON**. The switch is off by default and shows a disclaimer first. The status changes to ONLINE.

`Uninstall-YoRHaHelper.cmd` stops it and removes it from startup; then delete the folder. `Start-YoRHaHelper.cmd` runs it once without adding it to startup. It is one readable PowerShell script (open it in Notepad) with no install, no admin rights and no extra downloads.

**Privacy.** The helper listens on `127.0.0.1:47823`, which only programs on your PC can reach. It never connects to the internet, writes no files and keeps no log. It accepts commands only from the wallpaper itself, pages on your PC and this project's demo page; other websites are refused. The wallpaper keeps your calendar and schedule on your PC (Wallpaper Engine's local storage) and sends nothing to any server.

## Demo notes

The demo runs the same files Wallpaper Engine does, but in a browser. Some parts need Wallpaper Engine:

- The visualizer shows simulated levels. Live audio and INTEL's now playing need Wallpaper Engine's audio and Media Integration feeds
- Property changes come from its settings panel. In the browser, use SYSTEM > QUICK SETTINGS, or URL hash keys:

```
#theme=dark                  light | dark | auto
#language=ja                 auto | en | zh | ja | ko | ru | de | fr | es | pt
#place=hacking               map | quests | intel | archive | unit | hacking | garden | system
#place=quests&sub=wellness&wellness=true
#place=quests&sub=calendar   (also sub=schedule)
#audiogain=300&audioauto=false
#layout=right&uiscale=110
#charfiles=https://example.com/a.png|https://example.com/b.png
```

This repo does not include character images. The Workshop version includes a character set, and you can set **Character folder** to your own PNG renders. The file name becomes the on-screen name, so `01 - 2B - YoRHa No.2 Type B.png` shows 2B with that subtitle. Tall transparent PNGs (600 px or more) stand on the desktop. Other images appear only in ARCHIVE.

## Running it locally

Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

To use it in Wallpaper Engine, subscribe on the Workshop. Or open the editor, create a web wallpaper and point it at `index.html`.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `style.css`, `main.js` | The terminal, its panels, places and settings |
| `games.js`, `breach3d.js` | HACKING drills (BREACH uses `vendor/three.min.js`, MIT) |
| `planner.js` | CALENDAR, WEEKLY SCHEDULE, alerts, the desktop agenda and the on-screen keyboard |
| `helper/` | YoRHa Helper: music buttons and real-keyboard typing (optional, runs on your PC only) |
| `podlines.js` | The Pod's dialogue banks |
| `i18n.js`, `i18n/*.txt`, `lang/*.js` | Translations. Edit `i18n/<code>.txt`, then run `node tools/build_i18n.mjs` |
| `project.json` | Wallpaper Engine project and its properties |
| `tools/` | Dev helpers: translation build, the preview GIF capture, the BREACH test page |
