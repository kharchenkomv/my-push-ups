---
name: Expo web preview screenshots
description: Blank/white screenshots of the Expo artifact preview and how to handle them
---

The rule: a blank white screenshot of the Expo web preview right after a code change usually means Metro is mid-rebundle, not that the app is broken.

**Why:** Metro rebuilds the web bundle lazily on first request after edits; the screenshot tool captures before the bundle finishes, yielding an all-white frame while browser logs still look normal.

**How to apply:** Retake the screenshot once (a few seconds later) before investigating. Only debug if the second capture is also blank or browser logs show errors.
