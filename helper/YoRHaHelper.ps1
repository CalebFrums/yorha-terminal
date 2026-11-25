<#
  YoRHa Helper -- music buttons and real-keyboard typing for the YoRHa Terminal wallpaper.

  Wallpaper Engine lets a wallpaper see what is playing but not control it, and it sends no key presses to
  wallpapers. This small helper fills both gaps on your own PC:
    - Music: the wallpaper's INTEL buttons ask it to press the Windows media keys (previous, play/pause,
      next), so it works with any player that answers media keys (Spotify, browsers, MusicBee, ...).
    - Typing: "TYPE ON PC KEYBOARD" in the calendar and schedule editors asks it to open a small text box.
      You type there with your real keyboard (input methods for Chinese, Japanese and Korean work too)
      and the text goes back to the wallpaper. It never reads keys typed anywhere else.
    - PC stats: INTEL > HARDWARE and the stats strip read processor, memory, graphics, disk, network and
      temperature from Windows performance counters (and nvidia-smi when present), only while they are shown.

  Privacy: it listens on 127.0.0.1:47823, which only programs on this PC can reach. It never connects to
  the internet, writes no files and keeps no log. Only the wallpaper (file://), pages on this PC
  (localhost) and the project's GitHub demo page may send it commands; any other website is refused.
  No install and no admin rights are needed.

  Usage (or double-click the .cmd files next to this script):
    YoRHaHelper.ps1              run it (closing the window stops it)
    YoRHaHelper.ps1 -Install     also start it with Windows (adds a shortcut to your Startup folder)
    YoRHaHelper.ps1 -Uninstall   remove that shortcut and stop the running helper
    YoRHaHelper.ps1 -Stop        stop the running helper
    YoRHaHelper.ps1 -DryRun      testing: show what it would do instead of pressing keys
#>
param(
  [int]$Port = 47823,
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$Stop,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$App = 'YoRHa Helper'
$Version = 3
$Self = $MyInvocation.MyCommand.Path
$Shortcut = Join-Path ([Environment]::GetFolderPath('Startup')) 'YoRHa Helper.lnk'

function Send-Quit {
  try {
    Invoke-WebRequest -UseBasicParsing -Method Post -Uri "http://127.0.0.1:$Port/yorha/quit" -TimeoutSec 3 | Out-Null
    Write-Host "[OK] Stopped the running $App."
  } catch {
    Write-Host "[INFO] $App was not running."
  }
}

if ($Stop) { Send-Quit; exit 0 }

if ($Uninstall) {
  if (Test-Path -LiteralPath $Shortcut) { Remove-Item -LiteralPath $Shortcut -Force; Write-Host "[OK] Removed the Startup shortcut." }
  else { Write-Host "[INFO] No Startup shortcut was found." }
  Send-Quit
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

# Pages allowed to send commands. A request without an Origin header comes from a program on this PC.
function Test-Origin([string]$o) {
  if (-not $o) { return $true }
  if ($o -eq 'null' -or $o -like 'file://*') { return $true }
  if ($o -match '^https?://(localhost|127\.0\.0\.1)(:\d+)?$') { return $true }
  if ($o -eq 'https://calebfrums.github.io') { return $true }
  return $false
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
function Show-Input([string]$prompt, [string]$text, [int]$max, [string]$okText, [string]$cancelText) {
  $ink = [System.Drawing.Color]::FromArgb(78, 75, 66)
  $paper = [System.Drawing.Color]::FromArgb(218, 212, 187)
  $field = [System.Drawing.Color]::FromArgb(236, 232, 214)
  $f = New-Object System.Windows.Forms.Form
  $f.Text = 'YoRHa Terminal'
  $f.FormBorderStyle = 'FixedDialog'
  $f.MaximizeBox = $false
  $f.MinimizeBox = $false
  $f.StartPosition = 'CenterScreen'
  $f.TopMost = $true
  $f.BackColor = $paper
  $f.ForeColor = $ink
  $f.Font = New-Object System.Drawing.Font('Bahnschrift', 10)
  $f.ClientSize = New-Object System.Drawing.Size(600, 168)
  $f.KeyPreview = $true

  $bar = New-Object System.Windows.Forms.Label
  $bar.BackColor = [System.Drawing.Color]::FromArgb(186, 181, 160)
  $bar.Location = New-Object System.Drawing.Point(0, 0)
  $bar.Size = New-Object System.Drawing.Size(600, 34)
  $bar.Padding = New-Object System.Windows.Forms.Padding(14, 0, 0, 0)
  $bar.TextAlign = 'MiddleLeft'
  $bar.Text = ([char]0x25A0) + '   ' + $prompt
  $f.Controls.Add($bar)

  $tb = New-Object System.Windows.Forms.TextBox
  $tb.Location = New-Object System.Drawing.Point(20, 52)
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
    $b.Location = New-Object System.Drawing.Point($x, 112)
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
    [YoRHaHelperNative]::Focus($f.Handle)
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
if ($DryRun) { Write-Host '[INFO] Dry run: media keys are not pressed; actions are shown here instead.' }
Write-Host 'Leave this window open, or close it to stop.'

# ---------- PC stats ----------
# A background thread reads CPU, memory, GPU, disk, network and temperature from Windows performance
# counters (and nvidia-smi when present), but only while the wallpaper asked for them in the last 30 s.
# GET /yorha/stats returns the latest reading. Nothing leaves this PC.
$StatsShared = [hashtable]::Synchronized(@{ json = '{"ok":false,"warming":true}'; lastAsk = [DateTime]::MinValue; quit = $false })
$StatsScript = {
  param($S)
  $ErrorActionPreference = 'SilentlyContinue'
  $inv = [Globalization.CultureInfo]::InvariantCulture
  function Num($v, [int]$d) { if ($null -eq $v -or [double]::IsNaN([double]$v)) { return 'null' }; return ([math]::Round([double]$v, $d)).ToString($inv) }
  function Str($s) { return '"' + (([string]$s).Trim() -replace '\\', '\\' -replace '"', '\"' -replace '[\x00-\x1f]', ' ') + '"' }
  function Pct($v) { if ($null -eq $v) { return $null }; return [math]::Max(0, [math]::Min(100, [double]$v)) }

  $cpuName = ''; $memTotal = 0.0; $igpuName = ''
  try { $cpuName = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name.Trim() } catch {}
  try { $memTotal = [double](Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory } catch {}
  try { $igpuName = (Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'NVIDIA' } | Select-Object -First 1).Name } catch {}
  $cpu = $null
  try { $cpu = New-Object Diagnostics.PerformanceCounter('Processor Information', '% Processor Utility', '_Total'); [void]$cpu.NextValue() }
  catch { try { $cpu = New-Object Diagnostics.PerformanceCounter('Processor', '% Processor Time', '_Total'); [void]$cpu.NextValue() } catch { $cpu = $null } }
  $mem = $null; try { $mem = New-Object Diagnostics.PerformanceCounter('Memory', 'Available Bytes'); [void]$mem.NextValue() } catch {}
  $dsk = $null; try { $dsk = New-Object Diagnostics.PerformanceCounter('PhysicalDisk', '% Idle Time', '_Total'); [void]$dsk.NextValue() } catch {}
  $upc = $null; try { $upc = New-Object Diagnostics.PerformanceCounter('System', 'System Up Time'); [void]$upc.NextValue() } catch {}
  $catNet = $null; try { $catNet = New-Object Diagnostics.PerformanceCounterCategory('Network Interface') } catch {}
  $catGpu = $null; try { $catGpu = New-Object Diagnostics.PerformanceCounterCategory('GPU Engine') } catch {}
  $catGmem = $null; try { $catGmem = New-Object Diagnostics.PerformanceCounterCategory('GPU Adapter Memory') } catch {}
  $catTz = $null; try { $catTz = New-Object Diagnostics.PerformanceCounterCategory('Thermal Zone Information') } catch {}
  $smi = $null; try { $smi = (Get-Command nvidia-smi -ErrorAction Stop).Source } catch {}

  function Snap($cat, [string[]]$names) {
    $out = @{}
    if (-not $cat) { return $out }
    try {
      $d = $cat.ReadCategory()
      foreach ($n in $names) {
        $h = @{}
        $col = $d[$n]
        if ($col) { foreach ($v in $col.Values) { $h[$v.InstanceName] = $v.Sample } }
        $out[$n] = $h
      }
    } catch {}
    return $out
  }
  function Rate($prev, $cur, [string]$n) {
    $r = @{}
    if (-not $prev -or -not $prev[$n] -or -not $cur[$n]) { return $r }
    foreach ($k in $cur[$n].Keys) {
      if ($prev[$n].ContainsKey($k)) {
        try { $r[$k] = [Diagnostics.CounterSample]::Calculate($prev[$n][$k], $cur[$n][$k]) } catch {}
      }
    }
    return $r
  }

  $prevNet = $null; $prevGpu = $null; $drives = '[]'; $tick = 0; $wasIdle = $true
  while (-not $S.quit) {
    if (([DateTime]::UtcNow - $S.lastAsk).TotalSeconds -gt 30) {
      $wasIdle = $true
      Start-Sleep -Milliseconds 500
      continue
    }
    if ($wasIdle) {
      # Fresh baselines, so the first reading after a pause is not an average over the pause.
      $prevNet = Snap $catNet @('Bytes Received/sec', 'Bytes Sent/sec')
      $prevGpu = Snap $catGpu @('Utilization Percentage')
      if ($cpu) { [void]$cpu.NextValue() }
      if ($dsk) { [void]$dsk.NextValue() }
      $wasIdle = $false
      $tick = 0
      Start-Sleep -Milliseconds 1000
    }

    $parts = New-Object System.Collections.Generic.List[string]
    $parts.Add('"ok":true')

    $cpuPct = $null; if ($cpu) { try { $cpuPct = Pct $cpu.NextValue() } catch {} }
    $parts.Add('"cpu":{"name":' + (Str $cpuName) + ',"load":' + (Num $cpuPct 1) + ',"cores":' + [Environment]::ProcessorCount + '}')

    $avail = $null; if ($mem) { try { $avail = [double]$mem.NextValue() } catch {} }
    $used = if ($memTotal -gt 0 -and $null -ne $avail) { $memTotal - $avail } else { $null }
    $parts.Add('"mem":{"used":' + (Num $used 0) + ',"total":' + (Num $memTotal 0) + '}')

    $busy = $null; if ($dsk) { try { $busy = Pct (100 - $dsk.NextValue()) } catch {} }
    if ($tick % 15 -eq 0) {
      $dl = @()
      foreach ($dr in [IO.DriveInfo]::GetDrives()) {
        try {
          if ($dr.IsReady -and $dr.DriveType -eq 'Fixed') {
            $dl += '{"name":' + (Str $dr.Name.TrimEnd('\')) + ',"label":' + (Str $dr.VolumeLabel) + ',"used":' + (Num ($dr.TotalSize - $dr.AvailableFreeSpace) 0) + ',"total":' + (Num $dr.TotalSize 0) + '}'
          }
        } catch {}
      }
      $drives = '[' + ($dl -join ',') + ']'
    }
    $parts.Add('"disk":{"busy":' + (Num $busy 1) + ',"drives":' + $drives + '}')

    $curNet = Snap $catNet @('Bytes Received/sec', 'Bytes Sent/sec')
    $rx = 0.0; $tx = 0.0
    foreach ($v in (Rate $prevNet $curNet 'Bytes Received/sec').Values) { $rx += $v }
    foreach ($v in (Rate $prevNet $curNet 'Bytes Sent/sec').Values) { $tx += $v }
    $prevNet = $curNet
    $parts.Add('"net":{"down":' + (Num $rx 0) + ',"up":' + (Num $tx 0) + '}')

    # GPU load per adapter: sum over processes per engine type, then the busiest engine type
    # (the same way Task Manager does it).
    $curGpu = Snap $catGpu @('Utilization Percentage')
    $eng = @{}
    foreach ($e in (Rate $prevGpu $curGpu 'Utilization Percentage').GetEnumerator()) {
      if ($e.Key -match '(luid_0x[0-9a-fA-F]+_0x[0-9a-fA-F]+).*engtype_(.+)$') {
        $key = $Matches[1] + '|' + $Matches[2]
        $eng[$key] = [double]$eng[$key] + [double]$e.Value
      }
    }
    $prevGpu = $curGpu
    $load = @{}
    foreach ($e in $eng.GetEnumerator()) {
      $l = $e.Key.Split('|')[0]
      if (-not $load.ContainsKey($l) -or $e.Value -gt $load[$l]) { $load[$l] = $e.Value }
    }
    $vram = @{}
    $gm = Snap $catGmem @('Dedicated Usage')
    if ($gm['Dedicated Usage']) {
      foreach ($e in $gm['Dedicated Usage'].GetEnumerator()) {
        if ($e.Key -match '(luid_0x[0-9a-fA-F]+_0x[0-9a-fA-F]+)') { $vram[$Matches[1]] = [double]$vram[$Matches[1]] + [double]$e.Value.RawValue }
      }
    }
    $gpus = @()
    $nvLuid = $null
    if ($smi) {
      try {
        $line = (& $smi --query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw --format=csv,noheader,nounits 2>$null | Select-Object -First 1)
        $f = $line -split ',\s*'
        if ($f.Count -ge 5) {
          $nd = { param($x) $o = 0.0; if ([double]::TryParse($x, [Globalization.NumberStyles]::Float, $inv, [ref]$o)) { $o } else { $null } }
          $nvUsed = (& $nd $f[3]); if ($null -ne $nvUsed) { $nvUsed *= 1MB }
          $nvTot = (& $nd $f[4]); if ($null -ne $nvTot) { $nvTot *= 1MB }
          $gpus += '{"name":' + (Str $f[0]) + ',"load":' + (Num (Pct (& $nd $f[1])) 0) + ',"temp":' + (Num (& $nd $f[2]) 0) +
            ',"vram":' + (Num $nvUsed 0) + ',"vramTotal":' + (Num $nvTot 0) + ',"power":' + (Num (& $nd $f[5]) 1) + '}'
          # The adapter whose dedicated memory matches what nvidia-smi reports is the NVIDIA one.
          if ($null -ne $nvUsed) {
            $best = [double]::MaxValue
            foreach ($l in $vram.Keys) { $dlt = [math]::Abs($vram[$l] - $nvUsed); if ($dlt -lt $best) { $best = $dlt; $nvLuid = $l } }
          }
        }
      } catch {}
    }
    $other = $load.Keys | Where-Object { $_ -ne $nvLuid } | Sort-Object { -$load[$_] } | Select-Object -First 1
    if ($other) {
      $nm = if ($smi) { $igpuName } else { (Get-CimInstance Win32_VideoController | Select-Object -First 1).Name }
      $gpus += '{"name":' + (Str $nm) + ',"load":' + (Num (Pct $load[$other]) 0) + ',"temp":null,"vram":' + (Num $vram[$other] 0) + ',"vramTotal":null,"power":null}'
    }
    $parts.Add('"gpus":[' + ($gpus -join ',') + ']')

    $temp = $null
    $tz = Snap $catTz @('Temperature')
    if ($tz['Temperature']) { foreach ($v in $tz['Temperature'].Values) { $c = [double]$v.RawValue - 273.15; if ($c -gt -50 -and ($null -eq $temp -or $c -gt $temp)) { $temp = $c } } }
    $parts.Add('"temp":' + (Num $temp 0))

    $up = $null; if ($upc) { try { $up = $upc.NextValue() } catch {} }
    $parts.Add('"uptime":' + (Num $up 0))
    $parts.Add('"time":' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())

    $S.json = '{' + ($parts -join ',') + '}'
    $tick++
    Start-Sleep -Milliseconds 2000
  }
}
$statsPs = [powershell]::Create()
$statsPs.Runspace = [runspacefactory]::CreateRunspace()
$statsPs.Runspace.Open()
[void]$statsPs.AddScript($StatsScript).AddArgument($StatsShared)
[void]$statsPs.BeginInvoke()

$running = $true
while ($running) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 3000
    $client.SendTimeout = 3000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
    $first = $reader.ReadLine()
    if (-not $first) { continue }
    $origin = $null
    for ($i = 0; $i -lt 100; $i++) {
      $h = $reader.ReadLine()
      if ([string]::IsNullOrEmpty($h)) { break }
      if ($h -match '^Origin:\s*(.*)$') { $origin = $Matches[1].Trim() }
    }
    $parts = $first -split ' '
    $method = $parts[0]
    $target = if ($parts.Length -gt 1) { $parts[1] } else { '' }
    $path = ($target -split '\?', 2)[0]
    $query = if ($target.Contains('?')) { ($target -split '\?', 2)[1] } else { '' }

    if ($method -eq 'OPTIONS') {
      Send-Reply $stream 204 'No Content' ''
    } elseif ($method -eq 'GET' -and $path -eq '/yorha/ping') {
      Send-Reply $stream 200 'OK' ('{"ok":true,"app":"' + $App + '","version":' + $Version + ',"input":true,"stats":true}')
    } elseif (-not (Test-Origin $origin)) {
      if ($DryRun) { Write-Host '[DRY] refused a request from a website' }
      Send-Reply $stream 403 'Forbidden' '{"ok":false,"error":"origin"}'
    } elseif ($method -eq 'GET' -and $path -eq '/yorha/stats') {
      $StatsShared.lastAsk = [DateTime]::UtcNow
      Send-Reply $stream 200 'OK' $StatsShared.json
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
      $typed = Show-Input (Get-Query $query 'p') (Get-Query $query 't') $max $okText $cancelText
      if ($null -eq $typed) { Send-Reply $stream 200 'OK' '{"ok":false,"cancel":true}' }
      else { Send-Reply $stream 200 'OK' ('{"ok":true,"text":' + (ConvertTo-JsonString $typed) + '}') }
    } elseif ($method -eq 'POST' -and $path -eq '/yorha/quit' -and -not $origin) {
      Send-Reply $stream 200 'OK' '{"ok":true}'
      $running = $false
    } else {
      Send-Reply $stream 404 'Not Found' '{"ok":false}'
    }
  } catch {
    # A client that hung up or sent garbage; keep serving.
  } finally {
    $client.Close()
  }
}
$StatsShared.quit = $true
$listener.Stop()
Write-Host "[OK] $App stopped."
