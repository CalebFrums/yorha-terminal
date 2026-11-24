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
     The status changes to ONLINE.

  Start-YoRHaHelper.cmd     runs it once, without starting it with Windows
  Uninstall-YoRHaHelper.cmd stops it and removes it from Windows startup;
                            then you can delete this folder

Privacy
  - It listens on 127.0.0.1:47823, which only programs on this PC can reach.
  - It never connects to the internet, writes no files and keeps no log.
  - It reads only what you type into its own text box, never keys typed anywhere else.
  - It accepts commands only from the wallpaper itself, pages on this PC and the
    project's demo page; any other website is refused.
  - While the wallpaper's YORHA HELPER switch is off, the wallpaper never contacts it.

  YoRHaHelper.ps1 is a plain PowerShell script: open it in Notepad to read every line.

Source: https://github.com/CalebFrums/yorha-terminal (folder helper)
Fan-made, not affiliated with Square Enix.
