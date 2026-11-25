# YoRHa Terminal -- pinyin table for the on-screen keyboard's Chinese layout.
#   pwsh -File tools/build_pinyin.ps1 [-Roots <folders with Simplified Chinese text>]
# Writes pinyin.js (plain ASCII, \u escapes): window.YoRHaPinyin = { syl: {syllable: chars}, pre: {prefix: chars} }.
# - Characters: GB2312 (3755 common + 3008 less common simplified characters), read from code page 936.
# - Readings: Windows' own ICU (icu.dll, "Han-Latin"), tones dropped, u-umlaut written as v. ICU gives one
#   reading per character; tools/pinyin-extra.txt replaces it for common characters with several readings.
# - Order: how often each character appears in Simplified Chinese text found on this PC (game subtitles,
#   Steam and Wallpaper Engine UI text, the wallpaper's own i18n/zh.txt). Nothing is downloaded.
#   Characters the text never uses keep the GB2312 order, common set first.
# - pre: for a partial syllable (zh, xio, b) the 40 most frequent characters of every syllable it starts.
param(
  [string[]]$Roots = @('C:\Program Files (x86)\Steam', 'D:\SteamLibrary\steamapps\common', 'C:\Program Files\NVIDIA Corporation')
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$cs = @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

public static class PinyinBuild {
  [DllImport("icu.dll", CharSet = CharSet.Unicode)]
  static extern IntPtr utrans_openU(string id, int idLen, int dir, IntPtr rules, int rulesLen, IntPtr pe, ref int status);
  [DllImport("icu.dll", CharSet = CharSet.Unicode)]
  static extern void utrans_transUChars(IntPtr t, StringBuilder text, ref int textLen, int cap, int start, ref int limit, ref int status);
  [DllImport("icu.dll")]
  static extern void utrans_close(IntPtr t);

  // Tone marks off, u-umlaut as v, lower case.
  static string Plain(string s) {
    var d = s.Normalize(NormalizationForm.FormD);
    var sb = new StringBuilder();
    foreach (char c in d) {
      if (c == (char)0x308) {
        if (sb.Length > 0 && sb[sb.Length - 1] == 'u') sb[sb.Length - 1] = 'v';
        continue;
      }
      if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
      sb.Append(c);
    }
    return sb.ToString().Trim().ToLowerInvariant();
  }

  static string Esc(IEnumerable<char> chars) {
    var sb = new StringBuilder();
    foreach (char c in chars) sb.Append("\\").Append("u").Append(((int)c).ToString("x4"));
    return sb.ToString();
  }

  class Ch { public char C; public int Level; public int Order; public long Count; }

  public static string Run(string extraPath, string[] corpus, string outPath) {
    var log = new StringBuilder();
    Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    var gb = Encoding.GetEncoding(936);

    // 1. GB2312 hanzi: rows 0xB0-0xD7 are the common set (pinyin order), 0xD8-0xF7 the rest.
    var chars = new List<Ch>();
    var byChar = new Dictionary<char, Ch>();
    for (int hi = 0xB0; hi <= 0xF7; hi++) {
      for (int lo = 0xA1; lo <= 0xFE; lo++) {
        string s = gb.GetString(new byte[] { (byte)hi, (byte)lo });
        if (s.Length != 1 || s[0] < 0x4E00 || s[0] > 0x9FFF || byChar.ContainsKey(s[0])) continue;
        var ch = new Ch { C = s[0], Level = hi < 0xD8 ? 1 : 2, Order = chars.Count };
        chars.Add(ch);
        byChar[s[0]] = ch;
      }
    }
    log.AppendLine("[OK] GB2312 hanzi: " + chars.Count + " (" + chars.Count(c => c.Level == 1) + " common)");

    // 2. ICU readings.
    int st = 0;
    IntPtr tr = utrans_openU("Han-Latin", 9, 0, IntPtr.Zero, 0, IntPtr.Zero, ref st);
    if (st > 0) throw new Exception("ICU Han-Latin not available: " + st);
    var icu = new Dictionary<char, string>();
    int bad = 0;
    foreach (var ch in chars) {
      var sb = new StringBuilder(ch.C.ToString(), 64);
      int len = 1, lim = 1;
      st = 0;
      utrans_transUChars(tr, sb, ref len, 64, 0, ref lim, ref st);
      string r = st > 0 ? "" : Plain(sb.ToString(0, len));
      if (r.Length == 0 || r.Any(c => c < 'a' || c > 'z')) { bad++; continue; }
      icu[ch.C] = r;
    }
    utrans_close(tr);
    log.AppendLine("[OK] ICU readings: " + icu.Count + (bad > 0 ? " ([WARNING] " + bad + " without a plain reading, left out)" : ""));

    // 3. Replacement readings for characters with several.
    var extra = new Dictionary<char, List<KeyValuePair<string, double>>>();
    foreach (var raw in File.ReadAllLines(extraPath, Encoding.UTF8)) {
      var line = raw.Trim();
      if (line.Length == 0 || line[0] == '#') continue;
      var parts = line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
      char c = parts[0][0];
      if (parts[0].Length != 1 || !byChar.ContainsKey(c)) throw new Exception("pinyin-extra: not a GB2312 character: " + line);
      var list = new List<KeyValuePair<string, double>>();
      for (int i = 1; i < parts.Length; i++) {
        var kv = parts[i].Split(':');
        list.Add(new KeyValuePair<string, double>(kv[0], kv.Length > 1 ? double.Parse(kv[1], CultureInfo.InvariantCulture) : 1.0));
      }
      string own;
      icu.TryGetValue(c, out own);
      bool listed = own != null && list.Any(p => p.Key == own);
      log.AppendLine("  extra U+" + ((int)c).ToString("X4") + " icu=" + (own ?? "-") + " -> " + string.Join(" ", list.Select(p => p.Key + ":" + p.Value.ToString(CultureInfo.InvariantCulture))) + (listed ? "" : "   [CHECK] ICU reading not listed"));
      extra[c] = list;
    }

    // 4. Frequency from local text (each distinct file once).
    var seen = new HashSet<string>();
    long total = 0;
    int used = 0;
    using (var sha = SHA1.Create()) {
      foreach (var f in corpus) {
        byte[] bytes;
        try { bytes = File.ReadAllBytes(f); } catch { continue; }
        if (!seen.Add(Convert.ToBase64String(sha.ComputeHash(bytes)))) continue;
        string text;
        using (var rd = new StreamReader(new MemoryStream(bytes), Encoding.UTF8, true)) text = rd.ReadToEnd();
        long n = 0;
        foreach (char c in text) {
          Ch ch;
          if (byChar.TryGetValue(c, out ch)) { ch.Count++; n++; }
        }
        if (n > 0) { used++; total += n; }
      }
    }
    log.AppendLine("[OK] text: " + used + " files, " + total + " hanzi, " + chars.Count(c => c.Count > 0) + " distinct");

    // 5. Syllable lists.
    var bySyl = new Dictionary<string, List<KeyValuePair<Ch, double>>>();
    foreach (var ch in chars) {
      List<KeyValuePair<string, double>> rs;
      if (!extra.TryGetValue(ch.C, out rs)) {
        string own;
        if (!icu.TryGetValue(ch.C, out own)) continue;
        rs = new List<KeyValuePair<string, double>> { new KeyValuePair<string, double>(own, 1.0) };
      }
      foreach (var r in rs) {
        List<KeyValuePair<Ch, double>> l;
        if (!bySyl.TryGetValue(r.Key, out l)) bySyl[r.Key] = l = new List<KeyValuePair<Ch, double>>();
        l.Add(new KeyValuePair<Ch, double>(ch, ch.Count * r.Value));
      }
    }
    // Interjection-only syllables without a vowel (m, n, ng, hm, hng) would hide the partial-syllable lists.
    foreach (var k in bySyl.Keys.Where(k => k.IndexOfAny("aeiouv".ToCharArray()) < 0).ToList()) {
      log.AppendLine("  dropped syllable '" + k + "' (" + bySyl[k].Count + " characters)");
      bySyl.Remove(k);
    }
    Func<IEnumerable<KeyValuePair<Ch, double>>, List<char>> rank = (l) => l
      .OrderByDescending(p => p.Value).ThenBy(p => p.Key.Level).ThenBy(p => p.Key.Order)
      .Select(p => p.Key.C).Distinct().ToList();
    var syl = new SortedDictionary<string, List<char>>(StringComparer.Ordinal);
    foreach (var kv in bySyl) syl[kv.Key] = rank(kv.Value);
    if (syl.ContainsKey("lve") && !syl.ContainsKey("lue")) syl["lue"] = syl["lve"];
    if (syl.ContainsKey("nve") && !syl.ContainsKey("nue")) syl["nue"] = syl["nve"];

    // 6. Partial syllables.
    var pre = new SortedDictionary<string, List<char>>(StringComparer.Ordinal);
    var prefixes = new HashSet<string>();
    foreach (var s in bySyl.Keys) for (int i = 1; i < s.Length; i++) if (!syl.ContainsKey(s.Substring(0, i))) prefixes.Add(s.Substring(0, i));
    foreach (var p in prefixes) {
      var best = new Dictionary<char, KeyValuePair<Ch, double>>();
      foreach (var kv in bySyl) {
        if (!kv.Key.StartsWith(p, StringComparison.Ordinal)) continue;
        foreach (var e in kv.Value) {
          KeyValuePair<Ch, double> old;
          if (!best.TryGetValue(e.Key.C, out old) || old.Value < e.Value) best[e.Key.C] = e;
        }
      }
      pre[p] = rank(best.Values).Take(40).ToList();
    }

    var js = new StringBuilder();
    js.Append("/* YoRHa Terminal -- pinyin table for the on-screen keyboard, generated by tools/build_pinyin.ps1. Do not edit. */\n");
    js.Append("window.YoRHaPinyin = {\n\"syl\": {\n");
    js.Append(string.Join(",\n", syl.Select(kv => "\"" + kv.Key + "\":\"" + Esc(kv.Value) + "\"")));
    js.Append("\n},\n\"pre\": {\n");
    js.Append(string.Join(",\n", pre.Select(kv => "\"" + kv.Key + "\":\"" + Esc(kv.Value) + "\"")));
    js.Append("\n}\n};\n");
    File.WriteAllText(outPath, js.ToString(), new UTF8Encoding(false));
    log.AppendLine("[OK] " + Path.GetFileName(outPath) + ": " + syl.Count + " syllables, " + pre.Count + " partial, " + js.Length + " bytes");

    // A few lists to eyeball (as code points, the console may not show hanzi).
    foreach (var s in new[] { "shi", "de", "you", "xi", "zhong", "zh", "b" }) {
      List<char> l;
      if (syl.TryGetValue(s, out l) || pre.TryGetValue(s, out l))
        log.AppendLine("  " + s + ": " + string.Join(" ", l.Take(10).Select(c => ((int)c).ToString("X4"))));
    }
    return log.ToString();
  }
}
'@
Add-Type -TypeDefinition $cs

$pattern = '(?i)(schinese|zh[-_](cn|chs|hans))'
$corpus = [System.Collections.Generic.List[string]]::new()
foreach ($r in $Roots) {
  if (-not (Test-Path $r)) { Write-Host "[WARNING] missing: $r"; continue }
  Get-ChildItem $r -Recurse -File -Depth 7 -ErrorAction SilentlyContinue -Include *.txt, *.json |
    Where-Object { $_.Name -match $pattern -and $_.Length -lt 8MB } |
    ForEach-Object { $corpus.Add($_.FullName) }
}
$corpus.Add((Join-Path $root 'i18n\zh.txt'))
Write-Host "[OK] candidate text files: $($corpus.Count)"
[PinyinBuild]::Run((Join-Path $PSScriptRoot 'pinyin-extra.txt'), $corpus.ToArray(), (Join-Path $root 'pinyin.js'))
