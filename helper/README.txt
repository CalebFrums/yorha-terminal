YoRHa Helper -- optional companion for the YoRHa Terminal wallpaper
====================================================================

What it does
  Wallpaper Engine lets a wallpaper see what is playing but not control it, and it sends
  wallpapers no key presses. This helper fills both gaps on your own PC:
  - INTEL music buttons: previous, play/pause and next press the Windows media keys, so
    Spotify, browsers and most players respond.
  - TYPE ON PC KEYBOARD in the calendar and schedule editors: a small text box where you
    type with your real keyboard (Chinese, Japanese and Korean input methods work too).

Setup
  1. Keep these files in a folder you will not delete, such as Documents\YoRHaHelper.
  2. Double-click Install-YoRHaHelper.cmd. If Windows asks, choose Run
     (or More info, then Run anyway). It starts now and with every Windows sign-in.
  3. In the wallpaper, open SYSTEM > YORHA HELPER and press SWITCH ON.
  4. Press PAIR. The wallpaper shows a six-digit code and the helper opens a box:
     click the box, then type the code there. The status changes to ONLINE.

  Start-YoRHaHelper.cmd     runs it once, without starting it with Windows
  Uninstall-YoRHaHelper.cmd stops it, removes it from Windows startup and forgets the
                            pairing; then you can delete this folder

Updating from an older copy
  Replace the files in your folder with the new ones and double-click
  Install-YoRHaHelper.cmd again: it stops the old helper and starts the new one.
  Version 3 (November 2026) needs the wallpaper to be paired once (step 4).

Privacy
  - It listens on 127.0.0.1:47823, which only programs on this PC can reach.
  - It never connects to the internet and keeps no log.
  - The only file it writes is its pairing key:
    %LOCALAPPDATA%\YoRHa Helper\keys.txt (Uninstall-YoRHaHelper.cmd deletes it).
  - It reads only what you type into its own text box, never keys typed anywhere else.
  - It obeys only a wallpaper you paired with it. A website cannot pair, because it never
    sees the code, so websites cannot press keys or open the box.
  - While the wallpaper's YORHA HELPER switch is off, the wallpaper never contacts it.

  YoRHaHelper.ps1 is a plain PowerShell script: open it in Notepad to read every line.

Source: https://github.com/CalebFrums/yorha-terminal (folder helper)
Fan-made, not affiliated with Square Enix.
