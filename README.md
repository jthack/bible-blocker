# Bible Blocker

![Bible Blocker Screenshot](https://i.imgur.com/ZPROZIv.png)

A Chrome extension that blocks social media until you read a chapter of the Bible. One chapter per day. No skipping.

## How It Works

- **Blocks distracting sites** — Facebook, Twitter/X, Instagram, YouTube, TikTok, Reddit, Snapchat, Threads, and LinkedIn are blocked by default. Fully configurable.
- **Shows you a chapter** — When you try to visit a blocked site, you see today's Bible chapter instead (ESV translation).
- **One chapter per day** — You pick a book of the Bible and it walks you through one chapter each day, in order.
- **"I Read It" button** — Once you've read the chapter, click the button and all sites are unblocked for the rest of the day.
- **Picks up where you left off** — Tracks your progress. Tomorrow you get the next chapter automatically.
- **Book picker** — On first install (or after finishing a book), you choose which book to read next. You can switch books anytime.
- **Dark mode** — Calming tan/cream light mode or dark green dark mode. Your preference is saved.
- **Configurable block list** — Add or remove sites from the Settings page.

## Setup

### 1. Get an ESV API Key (free)

The extension uses the [ESV API](https://api.esv.org/) to fetch Bible chapters. You need a free API key:

1. Go to [https://api.esv.org/account/create-application/](https://api.esv.org/account/create-application/)
2. Create an account and register an application
3. Copy your API key

### 2. Add Your API Key

Open `blocked.js` and replace the token on **line 5**:

```javascript
const ESV_API_TOKEN = 'YOUR_API_KEY_HERE';
```

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `bible-blocker` folder
5. Try visiting youtube.com — you should see the book picker

## License

MIT
