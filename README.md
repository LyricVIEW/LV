# LyricView Studio

A customizable Apple Music-inspired lyrics visualizer with Spotify currently-playing integration.

## Quick start

1. Create an app at https://developer.spotify.com/dashboard and copy its **Client ID** (not the secret).
2. Add the exact redirect URI shown inside LyricView to the app's allowed Redirect URIs. For local development use `http://127.0.0.1:5500/` (Spotify may reject `localhost`).
3. Serve the folder over HTTP. For example, run `python -m http.server 5500 --bind 127.0.0.1` in this folder and open `http://127.0.0.1:5500/`.
4. Paste the Client ID, click Connect Spotify, and authorize. Start playing a song in Spotify.
5. For deployment, use Netlify or another HTTPS static host and register the exact production redirect URI in Spotify too.

## Features

Spotify PKCE OAuth (no client secret), automatic currently-playing polling, token refresh, track artwork, animated active-line following via LRCLIB timestamps, lyric timing adjustment, configurable backgrounds and typography, presets, fullscreen, and PNG export (best-effort).

## Limitations

- Spotify may restrict access to development apps/users; review the current Spotify developer eligibility and allowlist rules.
- Spotify Web API does not provide lyrics. LRCLIB is an independent community lyrics service; not all tracks have timed lyrics and usage must respect its terms and applicable rights.
- Active-line follow and highlighting require LRCLIB **syncedLyrics** (timestamped LRC). Songs with plain-only lyrics cannot be synchronized. Word-by-word highlighting is not claimed or simulated; LRCLIB lines usually contain only line timestamps.
- Use the **Lyric timing offset** slider when the active line is slightly too early or late. Negative offset delays the highlighting; positive offset advances it.
- Spotify polling is not sample-accurate; seek/skip can take up to 5 seconds to reflect.
- Browser screenshots can fail on cross-origin album artwork. Use custom images or OS screenshots if needed.
- Spotify's developer policy restricts synchronization of Spotify sound recordings with visual media; review Spotify's platform policies before publishing or distributing this as a public integration. This project uses the official Spotify Web Playback SDK for optional Premium browser playback; it does not download or modify Spotify audio.
- No API credentials are included. Client ID is public; never paste your client secret into this app.

## Fix in v1.1

The lyric viewport uses a dedicated animated inner track, so active lyrics actually move to the center while Spotify plays. Previous versions used `scrollTo()` on a vertically centered flex container, which could fail to follow the selected line. Also improved LRCLIB matching with a search fallback, and stopped highlighting incorrect lines for untimed lyrics.

## Version 2 — follow lyrics + sound

- **Fixed first-line placement and following:** timestamped lyrics open with the current line in the upper part of the lyrics screen, then smoothly move to each new line. If a song begins at 0:00, the lyrics begin at the top; if Spotify is already halfway through, the screen matches that current time instead of showing the wrong line.
- **Restart from 0:00:** click **↺ Restart from 0:00** to rewind both the Spotify track and its lyrics. The slider also seeks through the song.
- **Listen in this browser:** Spotify Premium users can click **🔊 Listen in this browser** to activate Spotify's official Web Playback SDK and transfer their audio into this browser tab. Other users can play music in Spotify and still view the lyrics screen. Audio in the browser requires Spotify Premium, browser audio permissions, and Spotify developer access/authorization for `streaming`, `user-read-playback-state`, `user-modify-playback-state`, `user-read-email`, and `user-read-private` in addition to `user-read-currently-playing`.
- After replacing earlier files, **Disconnect Spotify and Connect Spotify again** to grant the new playback scopes. If playback is blocked by Spotify permissions or browser restrictions, continue listening in the Spotify application and use the lyrics visualizer in the website.
- **Optional setting**: "Restart new songs from the beginning" applies when you explicitly transfer playback into the browser; it does not silently restart songs played elsewhere.

Important: Spotify's platform terms restrict synchronizing Spotify recordings with visual media. Check its current terms and permissions before deploying or distributing this integration. This is a local prototype and the audio SDK is an official Spotify component; the app does not host or redistribute Spotify music.

## Version 3 — begin at the first line

- New **Start every newly detected song at 0:00** option is enabled by default. When a song is detected from Spotify, LyricView asks Spotify to seek to the start once per track, and then highlights each lyric as its timestamp passes. Turn the option off to join a track at its existing playback position instead.
- The first lyric appears near the top of the display; later lyrics animate upward and into focus as the song advances.
- Fixed a stale-poll issue that could jump the lyrics back to the wrong time just after a seek on non-browser Spotify devices.
- Spotify sound: click **Listen in this browser** (Spotify Premium + official Spotify Web Playback SDK) or leave Spotify playing on another device. The webpage itself does not supply downloadable song audio.
- Use **Restart from 0:00** at any time to reset the track and lyrics manually.

If Spotify denies seeking (e.g., lack of playback permissions or no active device), LyricView will show an error and keep the current music position instead of pretending playback restarted.

## Version 4 — smoother, more accurate lyric following

- Song-follow transitions use a slower cinematic easing curve. The old line fades away as the new active line brightens, and the lyrics track glides vertically rather than jumping.
- **New Line switch delay** control (default 0.25 seconds): delays the visual line switch so lyrics don't appear too early when LRCLIB's timestamps lead the vocals. Set to 0 for exact source timestamps; adjust by ear for individual songs. This is a global preference saved in your browser.
- **Lyric timing offset** still gives you fine control: a negative offset delays further; a positive offset advances.
- Smooth, bounded corrections prevent routine Spotify polling and browser audio updates from repeatedly jumping or abruptly advancing the lyric position. Real seeks and skips still jump to the correct section.
- The original Spotify sound, artwork, presets, fullscreen, playback controls, and background options remain intact.

**Accuracy limitation:** Spotify position updates and community-contributed LRCLIB timestamps are not guaranteed to be exact. The site follows the available line timestamps, but it cannot automatically correct a poorly timed lyric file or guarantee millisecond-perfect sync with external Spotify devices.

## Version 5 — slow Apple Music-inspired between-line movement

- The lyric viewport **glides smoothly between adjacent line positions**, moving during the gap between their timestamps instead of waiting until a line changes and then jumping.
- Its movement starts up to **3.4 seconds before the next line** (configurable from 1–6 seconds). For shorter intervals, the full interval is used. The focus arrives at the next line when that line's adjusted timestamp is reached.
- **Highlights still change only at the exact adjusted timestamp**, never early; the visual glide does not change song/lyric timing.
- Animation is calculated from the current playback time every frame, so pause holds the current position, seeking jumps to the correct lyric, and Spotify time corrections do not queue overlapping animations.
- The existing **Lyric timing offset** and **Line switch delay** controls still apply. Set Line switch delay to 0 for the exact timestamps provided by LRCLIB.
- Note: LRCLIB only supplies line timestamps, which cannot guarantee alignment with each sung word. The interpolation is a visual animation, not more precise lyric source data.


## Version 6 — continuous crossfading glow

- The **Glow** checkbox now controls the line glow consistently: changing fonts or the inactive-opacity slider no longer causes the active glow to vanish. Turning Glow off removes glow entirely without changing lyric positioning.
- During each **Lyric glide**, the outgoing line loses glow and brightness while the incoming line gains them using the *same easing curve as the scrolling movement*. At the next line's timestamp, the new line is fully glowing, with no last-moment jump.
- Both lines remain rendered throughout the handoff, and the glow/opacity updates stay in sync even while pausing, seeking, or changing customization settings.
- Your previous saved settings and other features remain unchanged.

**Technical fix:** The previous settings handler rebuilt the lyrics element's `className`, inadvertently removing its `has-sync` class and disabling the active glow. V7 preserves that class while updating alignment, and renders each line's glow independently of font/opacity selectors.


## V7 — Softer lyric edges and alternating alignment

- **Soft edge fade:** Longer opacity feathering fades lyrics gradually at the top and bottom of the lyrics viewport so they do not end on a visible hard horizontal edge. The focused line remains in the clear center of the screen (including at 0:00).
- **Fourth alignment option:** Under **Lyrics → Alignment**, select **Alternating · Left / Right**. Line 1 is left-aligned, line 2 is right-aligned, line 3 is left, and so on. Left, Center, and Right still work normally.
- The synchronized glide and V6's glow-transfer behavior are unchanged; this update only improves visual clipping and adds the alignment layout.

## V8 — no hard glow/text cutoff, including when lines zoom

- The lyrics canvas bleeds into the unused horizontal space on both sides of the player, while the text stays aligned with its original position. The glowing shadow and slight active-line scale now have their own clearance instead of hitting the crop boundary at the first/last letter.
- Both sides of the canvas feather off softly. The previous top/bottom fading remains in place.
- Fullscreen lyrics use a wider maximum content area (1240px rather than 900px), with responsive safe side gutters.
- Very long lyrics and long unbroken words wrap within the safe text width instead of disappearing beyond the viewport. Left, right, center and alternating alignment are all supported.
- The Spotify syncing, glow interpolation, fonts, sizing and saved settings are unchanged.
