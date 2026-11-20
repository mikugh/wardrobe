# Wardrobe

A mobile-first web app for keeping track of your clothes across several wardrobes: at home, at the summer cottage, at your parents' place.

- **Wardrobes:** every piece of clothing is in exactly one wardrobe (or bag), so you always know where it is. Tap the wardrobe name at the top of the Wardrobe tab to switch wardrobes, see all of them grouped by wardrobe, or add, rename and delete wardrobes. To move a piece, edit it and pick another wardrobe, or move several at once with a bag.
- **Bags:** pack clothes into a bag when you go on a trip or move clothes between wardrobes. In the Bags tab, create a bag, then tap pieces (or a whole outfit) from any wardrobe to pack them. Packed clothes leave their wardrobe and are in the bag until you unpack them, either back where each came from or all into one wardrobe. On a trip, switch to the bag in the Wardrobe tab, and Choose outfit offers what's in it.
- **Sample clothes:** on first launch an empty wardrobe is filled with 8 illustrated sample items and 2 outfits, each marked "Sample", plus a sample "Summer cottage" wardrobe, so you can try everything out. Tap "Remove samples" in the banner to delete them all, or delete them one by one. "Try with sample clothes" on the empty wardrobe brings them back.
- **Add clothes:** take a photo (the phone camera app on phones, a live webcam view on computers) or pick several photos from your library. Photos are resized, and the main color is detected automatically.
- **Remove backgrounds:** tap "Remove background" on a photo (when adding or editing an item) to cut the item out, so grids and outfit collages look clean. The color is re-detected without the background. "Restore original" brings the photo back.
- **Browse:** search, filter by category, season, color or favorites, and sort by newest, most worn or least worn.
- **Wear history (per piece, off by default):** switch on "Wear history" in a piece's details to get an "I wore this today" button and see how often and when it was last worn. Forgot to log earlier wears? Tap "Adjust" on the Worn count to set the total; wears already logged with a date stay. Outfits get a "Wearing this today" button when at least one piece tracks wear, and it logs only those pieces. Turning it off hides the history but keeps it.
- **Brand and size:** optional fields when adding or editing a piece. Brands you've used before and common sizes (plus sizes you've used for that category) are suggested as you type, and search finds both.
- **Price and cost per wear:** add what a piece cost when adding or editing it ("49,90", "49.90" and "1 299 kr" all work). For pieces that track wear, the app shows cost per wear (price ÷ times worn), on the card and in the details, and the Wardrobe tab can sort by highest cost per wear. Pick the currency in Settings.
- **Outfits:** combine pieces into outfits, or use **Shuffle** to get a random suggestion for the season. Opening an outfit shows it top to toe, the way it's worn: hat, then jacket and top, bottoms, then shoes. Remove the pieces' backgrounds to get a clean flat-lay look.
- **Choose outfit:** shows the outfit top to toe and lets you swipe each piece sideways (hat, jacket, top, bottoms or dress, shoes, accessory) to try other combinations. You can also start from a saved outfit. Save a new combination as an outfit, or mark it as worn today. When an outfit's clothes are in different wardrobes (or some are packed in a bag), a warning shows what's where, in Choose outfit, the outfit details and the outfit builder.
- **Backup:** download all your wardrobes, bags and outfits as a JSON file and restore them on another device (Settings tab). Backups from before there were several wardrobes still restore; their clothes go into the first wardrobe.

All data (photos included) is stored locally in the browser's IndexedDB. Nothing is uploaded anywhere. See [Privacy](#privacy).

Background removal also runs on the device. It uses the [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) model through [Transformers.js](https://huggingface.co/docs/transformers.js). The first time you use it, the browser downloads the model (about 85 MB) from Hugging Face and caches it. It runs on the GPU through WebGPU where the GPU supports 16-bit floats (most recent phones and Macs, for example), and on the CPU otherwise. On the CPU each photo takes 10 to 30 seconds. RMBG-1.4 is licensed for non-commercial use only. Pick a different model before using this app commercially.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 on your computer.

### On your phone

`npm run dev` also prints a **Network** URL (e.g. `http://192.168.1.20:5173`). Open it on a phone that is on the same Wi-Fi. "Take a photo" opens the phone's camera app. To get a home-screen icon, open the browser menu and choose **Add to Home Screen**.

Photos are stored per browser and per address. Items added on `localhost` won't show up on the network URL, and the reverse is also true. To move items between them, use backup and restore.

## Build

```bash
npm run build     # type-checks and outputs static files to dist/
npm run preview
```

`dist/` is a static site that can be hosted anywhere (Netlify, GitHub Pages, Vercel, etc.). Serve it over **https** so the live camera works on desktop browsers.

## Run it from this computer

`npm run serve` serves `dist/` at http://127.0.0.1:5180 (set `WARDROBE_PORT` and `WARDROBE_HOST` to change that). It has no dependencies and reads the files on every request, so after `npm run build` the new version is live without a restart.

To start it in the background whenever you log in to Windows, run this in PowerShell from the project folder. It adds a shortcut to your Startup folder; delete `Wardrobe.lnk` there to undo it.

```
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Startup'))\Wardrobe.lnk")
$s.TargetPath = "$env:WINDIR\System32\conhost.exe"; $s.Arguments = "--headless `"$((Get-Command node).Source)`" serve.js"; $s.WorkingDirectory = "$PWD"; $s.Save()
Start-Process "$env:WINDIR\System32\conhost.exe" -ArgumentList "--headless", "`"$((Get-Command node).Source)`"", "serve.js" -WorkingDirectory $PWD
```

To reach it from your phone anywhere, with https so the camera works, publish it with Tailscale Funnel on a port of its own (Funnel allows 443, 8443 and 10000):

```
tailscale funnel --bg --https=8443 http://127.0.0.1:5180
```

It is then at `https://<computer-name>.<your-tailnet>.ts.net:8443/`. `tailscale funnel --https=8443 off` takes it down again. Give it its own port rather than a path next to another app (such as `/wardrobe/` beside something on `/`): browsers keep stored data per origin (scheme, host and port), not per path, so apps on the same origin can read each other's data. No access key is needed: the server only hands out the app itself, and everyone's clothes stay in their own browser. Each browser and address has its own wardrobe, so use backup and restore to move clothes from `localhost` to the public address.

## Privacy

Nothing a user adds leaves their device: clothes, photos and outfits live in the browser, and the server only serves the app's files. Photos are re-encoded when they are resized, which drops their EXIF metadata (including GPS location). Fonts are bundled with the app. The only third-party request is the one-time model download from Hugging Face when someone first uses background removal; it carries no photos. Backup files contain all photos and data unencrypted, so keep them somewhere private.
