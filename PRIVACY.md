# Privacy Policy — Vinyl Crackle

**Last updated:** April 10, 2026

## Overview

Vinyl Crackle is a Chrome extension that adds vinyl record surface noise (crackle) to audio playing on any website. This privacy policy explains what data the extension does and does not collect.

## Data Collection

**Vinyl Crackle does NOT collect, store, or transmit any personal data.**

Specifically:

- No browsing history is collected
- No audio or video content is accessed or recorded
- No analytics or tracking scripts are included
- No data is sent to any external server
- No cookies are created
- No user accounts are required

## Local Storage

The extension stores your preferences (enabled/disabled state, selected preset, slider values) using Chrome's built-in `chrome.storage.sync` API. This data:

- Is stored locally in your browser
- Syncs across your Chrome browsers via your Google account (a standard Chrome feature)
- Contains only extension settings — no personal information
- Can be deleted at any time by uninstalling the extension

## Permissions

| Permission | Why it's needed |
|------------|----------------|
| `storage` | Save your crackle settings (presets, slider values) |
| `activeTab` | Detect when media is playing on the current tab |

## How It Works

The crackle noise is generated entirely locally using mathematical algorithms (procedural audio synthesis). The extension does not intercept, modify, or access any audio or video content. It plays the crackle as a separate audio overlay.

## Third Parties

Vinyl Crackle does not use any third-party services, SDKs, or analytics tools.

## Open Source

The full source code is available at [github.com/ShinChanU/vinyl-crackle](https://github.com/ShinChanU/vinyl-crackle) for inspection.

## Contact

For questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/ShinChanU/vinyl-crackle/issues).

## Changes

If this privacy policy changes, the updated version will be posted to this page with a new "Last updated" date.
