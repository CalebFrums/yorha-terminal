<#
  YoRHa Helper -- music buttons and real-keyboard typing for the YoRHa Terminal wallpaper.

  Wallpaper Engine lets a wallpaper see what is playing but not control it, and it sends no key presses to
  wallpapers. This small helper fills both gaps on your own PC:
    - Music: the wallpaper's INTEL buttons ask it to press the Windows media keys (previous, play/pause,
      next), so it works with any player that answers media keys (Spotify, browsers, MusicBee, ...).
    - Typing: "TYPE ON PC KEYBOARD" in the calendar and schedule editors asks it to open a small text box.
      You type there with your real keyboard (input methods for Chinese, Japanese and Korean work too)
      and the text goes back to the wallpaper. It never reads keys typed anywhere else.

  Pairing: the helper obeys only a wallpaper you paired with it. In the wallpaper, SYSTEM > YORHA HELPER >
  PAIR shows a six-digit code and the helper opens a box asking for it; type the code there once. Websites
  cannot pair, because they never see the code. The pairing key is kept in one small file,
  %LOCALAPPDATA%\YoRHa Helper\keys.txt (-Forget or -Uninstall deletes it).

  Privacy: it listens on 127.0.0.1:47823, which only programs on this PC can reach. It never connects to
  the internet and keeps no log; the pairing key file is the only thing it writes. No install and no admin
  rights are needed.

  Usage (or double-click the .cmd files next to this script):
    YoRHaHelper.ps1              run it (closing the window stops it)
    YoRHaHelper.ps1 -Install     also start it with Windows (adds a shortcut to your Startup folder)
    YoRHaHelper.ps1 -Uninstall   remove that shortcut and the pairing key, and stop the running helper
    YoRHaHelper.ps1 -Forget      forget every paired wallpaper (each one asks to pair again)
    YoRHaHelper.ps1 -Stop        stop the running helper
    YoRHaHelper.ps1 -DryRun      testing: show what it would do instead of pressing keys
#>
param(
  [int]$Port = 47823,
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$Forget,
  [switch]$Stop,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$App = 'YoRHa Helper'
$Version = 3
$Self = $MyInvocation.MyCommand.Path
$Shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'YoRHa Helper.lnk'
$KeyDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'YoRHa Helper'
$KeyFile = Join-Path $KeyDir 'keys.txt'
$MaxKeys = 8

function Send-Quit {
  try {
    Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://127.0.0.1:$Port/yorha/quit" -TimeoutSec 3 | Out-Null
    Write-Host "[OK] Stopped the running $App."
  } catch {
    Write-Host "[INFO] $App was not running."
  }
}

function Remove-Keys {
  if (Test-Path -LiteralPath $KeyDir) {
    Remove-Item -LiteralPath $KeyDir -Recurse -Force
    Write-Host '[OK] Forgot every paired wallpaper.'
  } else {
    Write-Host '[INFO] No wallpaper was paired.'
  }
}

if ($Stop) { Send-Quit; exit 0 }

if ($Forget) {
  Send-Quit
  Remove-Keys
  Write-Host '[INFO] Start the helper again, then press PAIR in the wallpaper (SYSTEM > YORHA HELPER).'
  exit 0
}

if ($Uninstall) {
  if (Test-Path -LiteralPath $Shortcut) { Remove-Item -LiteralPath $Shortcut -Force; Write-Host "[OK] Removed the Startup shortcut." }
  else { Write-Host "[INFO] No Startup shortcut was found." }
  Send-Quit
  Remove-Keys
  exit 0
}

if ($Install) {
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($Shortcut)
  $lnk.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $lnk.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $Self + '"'
  $lnk.WorkingDirectory = Split-Path -Parent $Self
  $lnk.Description = 'Music buttons and keyboard typing for the YoRHa Terminal wallpaper'
  $lnk.Save()
  Write-Host "[OK] $App will start with Windows (shortcut: $Shortcut)."
  # A running older copy holds the port; stop it so the new one can start.
  Send-Quit
  Start-Sleep -Milliseconds 500
  Start-Process -WindowStyle Hidden -FilePath $lnk.TargetPath -ArgumentList $lnk.Arguments
  Write-Host "[OK] Started it in the background."
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class YoRHaHelperNative {
  [DllImport("user32.dll")] private static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hwnd);
  public static void Tap(byte vk) {
    keybd_event(vk, 0, 1, UIntPtr.Zero); // KEYEVENTF_EXTENDEDKEY
    keybd_event(vk, 0, 3, UIntPtr.Zero); // KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP
  }
  // Windows only lets the program that got the last input take focus; a tap of Alt counts as input,
  // so the text box can come to the front and take the keyboard straight away.
  public static void Focus(IntPtr hwnd) {
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    SetForegroundWindow(hwnd);
  }
}
'@
[System.Windows.Forms.Application]::EnableVisualStyles()

# Windows virtual-key codes for the media keys.
$Keys = @{
  'playpause' = 0xB3; 'next' = 0xB0; 'prev' = 0xB1; 'stop' = 0xB2
  'volup' = 0xAF; 'voldown' = 0xAE; 'mute' = 0xAD
}

# ---------- pairing keys ----------

$Paired = New-Object System.Collections.Generic.List[string]
if (Test-Path -LiteralPath $KeyFile) {
  foreach ($line in [IO.File]::ReadAllLines($KeyFile)) {
    $k = $line.Trim().ToLowerInvariant()
    if ($k -match '^[0-9a-f]{32}$' -and -not $Paired.Contains($k)) { $Paired.Add($k) }
  }
}

function Test-Key([string]$k) {
  if (-not $k) { return $false }
  return $Paired.Contains($k.Trim().ToLowerInvariant())
}

function New-Key {
  $bytes = New-Object byte[] 16
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  $k = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
  $Paired.Add($k)
  while ($Paired.Count -gt $MaxKeys) { $Paired.RemoveAt(0) }
  if (-not (Test-Path -LiteralPath $KeyDir)) { New-Item -ItemType Directory -Path $KeyDir | Out-Null }
  [IO.File]::WriteAllLines($KeyFile, $Paired.ToArray())
  return $k
}

# A page that is not paired may ask to pair at most once every 10 s, and three failed or cancelled
# tries in a row lock pairing for 10 minutes, so no page can keep opening the box.
$PairGate = @{ next = [DateTime]::MinValue; fails = 0; lockUntil = [DateTime]::MinValue }

# The pairing box's text is the helper's own, never the caller's, so a website cannot write
# "type 123456" into it. Pages choose only the language. Written as \u escapes to keep this file ASCII.
$PairText = @{
  'en' = @('Type the six-digit code that YoRHa Terminal shows on your desktop (SYSTEM > YORHA HELPER). If a website or anyone else gave you a code, press CANCEL.', 'PAIR', 'CANCEL')
  'de' = @('Gib den sechsstelligen Code ein, den YoRHa Terminal auf deinem Desktop zeigt (SYSTEM > YORHA HELPER). Hat dir eine Website oder jemand anderes einen Code gegeben, dr\u00fccke ABBRECHEN.', 'KOPPELN', 'ABBRECHEN')
  'fr' = @('Tapez le code \u00e0 six chiffres affich\u00e9 par YoRHa Terminal sur votre bureau (SYST\u00c8ME > YORHA HELPER). Si un site web ou quelqu\u0027un d\u0027autre vous a donn\u00e9 un code, appuyez sur ANNULER.', 'ASSOCIER', 'ANNULER')
  'es' = @('Escribe el c\u00f3digo de seis d\u00edgitos que YoRHa Terminal muestra en tu escritorio (SISTEMA > YORHA HELPER). Si una web o cualquier otra persona te dio un c\u00f3digo, pulsa CANCELAR.', 'VINCULAR', 'CANCELAR')
  'pt' = @('Digite o c\u00f3digo de seis d\u00edgitos que o YoRHa Terminal mostra na sua \u00e1rea de trabalho (SISTEMA > YORHA HELPER). Se um site ou outra pessoa lhe deu um c\u00f3digo, clique em CANCELAR.', 'PAREAR', 'CANCELAR')
  'ru' = @('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0448\u0435\u0441\u0442\u0438\u0437\u043d\u0430\u0447\u043d\u044b\u0439 \u043a\u043e\u0434, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 YoRHa Terminal \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043d\u0430 \u0440\u0430\u0431\u043e\u0447\u0435\u043c \u0441\u0442\u043e\u043b\u0435 (\u0421\u0418\u0421\u0422\u0415\u041c\u0410 > YORHA HELPER). \u0415\u0441\u043b\u0438 \u043a\u043e\u0434 \u0432\u0430\u043c \u0434\u0430\u043b \u0441\u0430\u0439\u0442 \u0438\u043b\u0438 \u043a\u0442\u043e-\u0442\u043e \u0434\u0440\u0443\u0433\u043e\u0439, \u043d\u0430\u0436\u043c\u0438\u0442\u0435 \u041e\u0422\u041c\u0415\u041d\u0410.', '\u0421\u0412\u042f\u0417\u0410\u0422\u042c', '\u041e\u0422\u041c\u0415\u041d\u0410')
  'ja' = @('YoRHa Terminal \u304c\u30c7\u30b9\u30af\u30c8\u30c3\u30d7\u306b\u8868\u793a\u3057\u3066\u3044\u308b6\u6841\u306e\u30b3\u30fc\u30c9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\uff08\u30b7\u30b9\u30c6\u30e0 > YORHA HELPER\uff09\u3002Web\u30b5\u30a4\u30c8\u3084\u4ed6\u306e\u8ab0\u304b\u304b\u3089\u6e21\u3055\u308c\u305f\u30b3\u30fc\u30c9\u306a\u3089\u3001\u30ad\u30e3\u30f3\u30bb\u30eb\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002', '\u30da\u30a2\u30ea\u30f3\u30b0', '\u30ad\u30e3\u30f3\u30bb\u30eb')
  'ko' = @('YoRHa Terminal\uc774 \ubc14\ud0d5 \ud654\uba74\uc5d0 \ud45c\uc2dc\ud55c 6\uc790\ub9ac \ucf54\ub4dc\ub97c \uc785\ub825\ud558\uc138\uc694(\uc2dc\uc2a4\ud15c > YORHA HELPER). \uc6f9\uc0ac\uc774\ud2b8\ub098 \ub2e4\ub978 \uc0ac\ub78c\uc774 \uc54c\ub824 \uc900 \ucf54\ub4dc\ub77c\uba74 \ucde8\uc18c\ub97c \ub204\ub974\uc138\uc694.', '\ud398\uc5b4\ub9c1', '\ucde8\uc18c')
  'zh' = @('\u8f93\u5165 YoRHa Terminal \u5728\u684c\u9762\u4e0a\u663e\u793a\u7684\u516d\u4f4d\u6570\u4ee3\u7801\uff08\u7cfb\u7edf > YORHA HELPER\uff09\u3002\u5982\u679c\u4ee3\u7801\u6765\u81ea\u7f51\u7ad9\u6216\u5176\u4ed6\u4eba\uff0c\u8bf7\u6309\u201c\u53d6\u6d88\u201d\u3002', '\u914d\u5bf9', '\u53d6\u6d88')
}
function Get-PairText([string]$lang) {
  $t = $PairText[$lang]
  if (-not $t) { $t = $PairText['en'] }
  return @($t | ForEach-Object { [regex]::Unescape($_) })
}

# ---------- requests ----------

# Pages allowed to send commands. A request without an Origin header comes from a program on this PC.
# The wallpaper itself (file://) sends Origin "null", which sandboxed frames on any website can send too,
# so every command also needs a pairing key.
function Test-Origin([string]$o) {
  if (-not $o) { return $true }
  if ($o -eq 'null' -or $o -like 'file://*') { return $true }
  if ($o -match '^https?://(localhost|127\.0\.0\.1)(:\d+)?$') { return $true }
  if ($o -eq 'https://calebfrums.github.io') { return $true }
  return $false
}

# A website that points its own domain at 127.0.0.1 (DNS rebinding) still sends its own Host name.
function Test-HostHeader([string]$h) {
  if (-not $h) { return $false }
  $h = $h.ToLowerInvariant()
  return ($h -eq "127.0.0.1:$Port" -or $h -eq "localhost:$Port")
}

function ConvertTo-JsonString([string]$s) {
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append('"')
  foreach ($ch in $s.ToCharArray()) {
    $c = [int]$ch
    if ($ch -eq '"') { [void]$sb.Append('\"') }
    elseif ($ch -eq '\') { [void]$sb.Append('\\') }
    elseif ($c -lt 32) { [void]$sb.Append(' ') }
    else { [void]$sb.Append($ch) }
  }
  [void]$sb.Append('"')
  return $sb.ToString()
}

function Get-Query([string]$query, [string]$name) {
  foreach ($pair in ($query -split '&')) {
    $kv = $pair -split '=', 2
    if ($kv[0] -eq $name -and $kv.Length -eq 2) { return [Uri]::UnescapeDataString($kv[1].Replace('+', ' ')) }
  }
  return ''
}

# The text box, in the wallpaper's colours. Returns the text, or $null when cancelled or left alone.
# $note adds a wrapped paragraph above the field; $grab takes the keyboard focus at once (the pairing box
# does not, so a page that opens it cannot pull keys typed into another window).
function Show-Input([string]$prompt, [string]$text, [int]$max, [string]$okText, [string]$cancelText, [string]$title, [string]$note, [bool]$grab = $true) {
  $ink = [System.Drawing.Color]::FromArgb(78, 75, 66)
  $paper = [System.Drawing.Color]::FromArgb(218, 212, 187)
  $field = [System.Drawing.Color]::FromArgb(236, 232, 214)
  $f = New-Object System.Windows.Forms.Form
  $f.Text = $(if ($title) { $title } else { 'YoRHa Terminal' })
  $f.FormBorderStyle = 'FixedDialog'
  $f.MaximizeBox = $false
  $f.MinimizeBox = $false
  $f.StartPosition = 'CenterScreen'
  $f.TopMost = $true
  $f.BackColor = $paper
  $f.ForeColor = $ink
  $f.Font = New-Object System.Drawing.Font('Bahnschrift', 10)
  $extra = if ($note) { 66 } else { 0 }
  $f.ClientSize = New-Object System.Drawing.Size(600, (168 + $extra))
  $f.KeyPreview = $true

  $bar = New-Object System.Windows.Forms.Label
  $bar.BackColor = [System.Drawing.Color]::FromArgb(186, 181, 160)
  $bar.Location = New-Object System.Drawing.Point(0, 0)
  $bar.Size = New-Object System.Drawing.Size(600, 34)
  $bar.Padding = New-Object System.Windows.Forms.Padding(14, 0, 0, 0)
  $bar.TextAlign = 'MiddleLeft'
  $bar.AutoEllipsis = $true
  $bar.Text = ([char]0x25A0) + '   ' + $prompt
  $f.Controls.Add($bar)

  if ($note) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Location = New-Object System.Drawing.Point(20, 44)
    $lbl.Size = New-Object System.Drawing.Size(560, 60)
    $lbl.Text = $note
    $f.Controls.Add($lbl)
  }

  $tb = New-Object System.Windows.Forms.TextBox
  $tb.Location = New-Object System.Drawing.Point(20, (52 + $extra))
  $tb.Size = New-Object System.Drawing.Size(560, 34)
  $tb.Font = New-Object System.Drawing.Font('Bahnschrift', 15)
  $tb.BorderStyle = 'FixedSingle'
  $tb.BackColor = $field
  $tb.ForeColor = $ink
  $tb.MaxLength = [Math]::Max(1, [Math]::Min(200, $max))
  $tb.Text = $text
  $f.Controls.Add($tb)

  $mk = {
    param($label, $x, $filled)
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $label
    $b.FlatStyle = 'Flat'
    $b.FlatAppearance.BorderColor = $ink
    $b.BackColor = $(if ($filled) { $ink } else { $paper })
    $b.ForeColor = $(if ($filled) { $paper } else { $ink })
    $b.Location = New-Object System.Drawing.Point($x, (112 + $extra))
    $b.Size = New-Object System.Drawing.Size(130, 36)
    $f.Controls.Add($b)
    return $b
  }
  $ok = & $mk $okText 310 $true
  $cancel = & $mk $cancelText 450 $false
  $ok.DialogResult = 'OK'
  $cancel.DialogResult = 'Cancel'
  $f.AcceptButton = $ok
  $f.CancelButton = $cancel

  # A forgotten box closes itself after three minutes.
  $timer = New-Object System.Windows.Forms.Timer
  $timer.Interval = 180000
  $timer.Add_Tick({ $f.DialogResult = 'Cancel'; $f.Close() })
  $f.Add_Shown({
    if ($grab) { [YoRHaHelperNative]::Focus($f.Handle) }
    $f.Activate()
    $tb.Focus()
    $tb.SelectionStart = $tb.Text.Length
    $timer.Start()
  })
  $result = $f.ShowDialog()
  $timer.Stop()
  $typed = $tb.Text
  $f.Dispose()
  if ($result -eq 'OK') { return $typed }
  return $null
}

function Send-Reply($stream, [int]$code, [string]$status, [string]$body) {
  $head = "HTTP/1.1 $code $status`r`n" +
    "Content-Type: application/json; charset=utf-8`r`n" +
    "Access-Control-Allow-Origin: *`r`n" +
    "Access-Control-Allow-Methods: GET, POST, OPTIONS`r`n" +
    "Access-Control-Allow-Private-Network: true`r`n" +
    "Cache-Control: no-store`r`n" +
    "Content-Length: " + [Text.Encoding]::UTF8.GetByteCount($body) + "`r`n" +
    "Connection: close`r`n`r`n"
  $bytes = [Text.Encoding]::UTF8.GetBytes($head + $body)
  $stream.Write($bytes, 0, $bytes.Length)
}

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
try {
  $listener.Start()
} catch {
  Write-Host "[ERROR] Port $Port is busy. Is $App already running? (Use -Stop to stop it.)"
  exit 1
}
Write-Host "[OK] $App is running on this PC only (127.0.0.1:$Port). Nothing is logged or sent anywhere."
Write-Host "[INFO] Paired wallpapers: $($Paired.Count). Pair one in the wallpaper: SYSTEM > YORHA HELPER > PAIR."
if ($DryRun) { Write-Host '[INFO] Dry run: media keys are not pressed; actions are shown here instead.' }
Write-Host 'Leave this window open, or close it to stop.'

$running = $true
while ($running) {
  $client = $null
  try {
    $client = $listener.AcceptTcpClient()
    $client.ReceiveTimeout = 3000
    $client.SendTimeout = 3000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
    $first = $reader.ReadLine()
    if (-not $first) { continue }
    $origin = $null
    $hostHeader = $null
    $fromBrowser = $false
    $complete = $false
    for ($i = 0; $i -lt 100; $i++) {
      $h = $reader.ReadLine()
      if ($null -eq $h) { break }
      if ($h -eq '') { $complete = $true; break }
      if ($h -match '^Origin:\s*(.*)$') { $origin = $Matches[1].Trim() }
      elseif ($h -match '^Host:\s*(.*)$') { $hostHeader = $Matches[1].Trim() }
      elseif ($h -match '^(Sec-Fetch-|Referer:)') { $fromBrowser = $true }
    }
    $parts = $first -split ' '
    $method = $parts[0]
    $target = if ($parts.Length -gt 1) { $parts[1] } else { '' }
    $path = ($target -split '\?', 2)[0]
    $query = if ($target.Contains('?')) { ($target -split '\?', 2)[1] } else { '' }
    $key = Get-Query $query 'k'

    # Headers cut short or too many of them: the checks below could not see Host or Origin.
    if (-not $complete) {
      Send-Reply $stream 400 'Bad Request' '{"ok":false,"error":"headers"}'
    } elseif (-not (Test-HostHeader $hostHeader)) {
      Send-Reply $stream 403 'Forbidden' '{"ok":false,"error":"host"}'
    } elseif ($method -eq 'OPTIONS') {
      Send-Reply $stream 204 'No Content' ''
    } elseif ($method -eq 'GET' -and $path -eq '/yorha/ping') {
      $isPaired = if (Test-Key $key) { 'true' } else { 'false' }
      Send-Reply $stream 200 'OK' ('{"ok":true,"app":"' + $App + '","version":' + $Version + ',"input":true,"pair":true,"paired":' + $isPaired + '}')
    } elseif (-not (Test-Origin $origin)) {
      if ($DryRun) { Write-Host '[DRY] refused a request from a website' }
      Send-Reply $stream 403 'Forbidden' '{"ok":false,"error":"origin"}'
    } elseif ($method -eq 'POST' -and $path -eq '/yorha/pair') {
      $code = (Get-Query $query 'c') -replace '\s', ''
      $now = Get-Date
      if ($code -notmatch '^\d{6}$') {
        Send-Reply $stream 400 'Bad Request' '{"ok":false,"error":"code"}'
      } elseif ($now -lt $PairGate.lockUntil -or $now -lt $PairGate.next) {
        if ($DryRun) { Write-Host '[DRY] refused a pairing request (too many tries)' }
        Send-Reply $stream 429 'Too Many Requests' '{"ok":false,"error":"wait"}'
      } else {
        $pt = Get-PairText ((Get-Query $query 'lang').ToLowerInvariant())
        if ($DryRun) { Write-Host '[DRY] opening the pairing box' }
        $typed = Show-Input ('YORHA HELPER // ' + $pt[1]) '' 12 $pt[1] $pt[2] 'YoRHa Helper' $pt[0] $false
        $PairGate.next = (Get-Date).AddSeconds(10)
        if ($null -ne $typed -and ($typed -replace '\s', '') -eq $code) {
          $PairGate.fails = 0
          $newKey = New-Key
          if ($DryRun) { Write-Host '[DRY] paired a wallpaper' }
          Send-Reply $stream 200 'OK' ('{"ok":true,"key":"' + $newKey + '"}')
        } else {
          $PairGate.fails++
          if ($PairGate.fails -ge 3) {
            $PairGate.fails = 0
            $PairGate.lockUntil = (Get-Date).AddMinutes(10)
          }
          if ($null -eq $typed) { Send-Reply $stream 200 'OK' '{"ok":false,"cancel":true}' }
          else { Send-Reply $stream 200 'OK' '{"ok":false,"error":"mismatch"}' }
        }
      }
    } elseif ($method -eq 'POST' -and $path -eq '/yorha/quit' -and -not $origin -and -not $fromBrowser) {
      # Only -Stop, -Install and -Uninstall on this PC: browsers send Origin or Sec-Fetch-* headers.
      Send-Reply $stream 200 'OK' '{"ok":true}'
      $running = $false
    } elseif ($method -eq 'POST' -and -not (Test-Key $key)) {
      if ($DryRun) { Write-Host '[DRY] refused a request from a page that is not paired' }
      Send-Reply $stream 401 'Unauthorized' '{"ok":false,"error":"key"}'
    } elseif ($method -eq 'POST' -and $path -match '^/yorha/media/([a-z]+)$' -and $Keys.ContainsKey($Matches[1])) {
      $cmd = $Matches[1]
      if ($DryRun) { Write-Host "[DRY] would press: $cmd" }
      else { [YoRHaHelperNative]::Tap([byte]$Keys[$cmd]) }
      Send-Reply $stream 200 'OK' '{"ok":true}'
    } elseif ($method -eq 'POST' -and $path -eq '/yorha/input') {
      $max = 0
      [void][int]::TryParse((Get-Query $query 'n'), [ref]$max)
      if ($max -le 0) { $max = 60 }
      $okText = Get-Query $query 'ok'
      $cancelText = Get-Query $query 'cancel'
      if (-not $okText) { $okText = 'OK' }
      if (-not $cancelText) { $cancelText = 'CANCEL' }
      if ($DryRun) { Write-Host '[DRY] opening the text box' }
      $typed = Show-Input (Get-Query $query 'p') (Get-Query $query 't') $max $okText $cancelText ''
      if ($null -eq $typed) { Send-Reply $stream 200 'OK' '{"ok":false,"cancel":true}' }
      else { Send-Reply $stream 200 'OK' ('{"ok":true,"text":' + (ConvertTo-JsonString $typed) + '}') }
    } elseif ($method -eq 'POST' -and $path -eq '/yorha/unpair') {
      [void]$Paired.Remove($key.Trim().ToLowerInvariant())
      if ($Paired.Count) { [IO.File]::WriteAllLines($KeyFile, $Paired.ToArray()) }
      elseif (Test-Path -LiteralPath $KeyFile) { Remove-Item -LiteralPath $KeyFile -Force }
      Send-Reply $stream 200 'OK' '{"ok":true}'
    } else {
      Send-Reply $stream 404 'Not Found' '{"ok":false}'
    }
  } catch {
    # A client that hung up or sent garbage (or a failed accept); keep serving.
  } finally {
    if ($client) { $client.Close() }
  }
}
$listener.Stop()
Write-Host "[OK] $App stopped."
