# VidNavigator skills: video for AI agents

**Paste a video link and ask.** Your agent reads what is said in the video and answers with timestamps. YouTube, TikTok, Instagram, X, Facebook, Vimeo, Dailymotion, Loom, Rumble and Snapchat, videos of any length.

```text
/watch https://www.youtube.com/watch?v=jNQXAC9IVRw what does he say about the elephants?
/search tiktok creatine gummies, most liked this week in the UK
/search youtube Neil deGrasse Tyson explains gravity
/tiktok-live skincare
```

Or just say it: *"transcribe this Instagram reel and give me the three key points"*, *"take these 80 TikToks and give me a CSV with the product, the price and the claims"*.

**Nothing to install on your machine:** no yt-dlp, no ffmpeg, no speech-to-text model, no browser cookies. The videos are read by the [VidNavigator](https://vidnavigator.com) API, so the same skills work in Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot and every agent that supports [Agent Skills](https://agentskills.io).

## The skills

| Skill | Use it like this | What the agent does |
|---|---|---|
| [`watch`](skills/watch/SKILL.md) | `/watch <link> [question]` | Reads the captions, or runs speech-to-text when there are none (Instagram, for instance), and answers with timestamps |
| [`search`](skills/search/SKILL.md) | `/search tiktok <keywords>` | The latest or most liked TikToks for a keyword, by country and period, or the videos of one account, with views, likes, comments and shares. No TikTok login needed |
| | `/search youtube <request>` | Finds YouTube videos and links the passage that matches: a quote, an explanation, or videos for and against a claim or a post on X |
| [`tiktok-live`](skills/tiktok-live/SKILL.md) | `/tiktok-live <keywords>` or `/tiktok-live @creator` | The LIVE rooms broadcasting right now for a keyword, and one room with its viewers and latest comments |
| [`video-dataset`](skills/video-dataset/SKILL.md) | "Give me a CSV of these videos with the brand, the price and the claims" | Finds the videos, extracts the same fields from each one, writes one row per video |
| [`vidnavigator-api`](skills/vidnavigator-api/SKILL.md) | "Add video transcripts to my app" | Writes code against the VidNavigator API with the Python and JavaScript SDKs |

You do not have to type a command: your agent picks a skill on its own when your request calls for it.

## Install

**1. Get an API key** in [VidNavigator Studio → API](https://vidnavigator.com/studio/api). The trial is free and needs no credit card.

**2. Install the skills** for your agent.

### Claude Code

```text
/plugin marketplace add vidnavigator/skills
/plugin install vidnavigator@vidnavigator
```

Claude Code asks for your API key and keeps it in your system's secure storage. The plugin brings the skills and the VidNavigator MCP server, so Claude calls the tools natively. Type `/watch` and pick the suggestion (`/vidnavigator:watch`).

From a terminal, in one command:

```bash
claude plugin install vidnavigator --marketplace vidnavigator/skills --config api_key=YOUR_API_KEY
```

### Codex, Cursor, Gemini CLI, Copilot, OpenCode, Windsurf and other agents

```bash
npx skills add vidnavigator/skills -g
```

The [skills CLI](https://github.com/vercel-labs/skills) asks which agents to install into (or pass `-a codex`, `-a cursor`, `-a gemini-cli`, `-a github-copilot`...). It needs Node.js 22.20 or later; the skills themselves run on Node.js 18. Then give the skills your API key, in one of two ways:

```bash
export VIDNAVIGATOR_API_KEY="your_key"                 # macOS, Linux
setx VIDNAVIGATOR_API_KEY "your_key"                   # Windows, then reopen the terminal
```

or save the key, alone on one line, in the file `~/.config/vidnavigator/api_key`. The file is the safer choice for desktop apps, which do not always see your shell's variables.

Restart your agent, then `/watch <link>`.

<details>
<summary>Codex: install as a plugin instead</summary>

```bash
codex plugin marketplace add vidnavigator/skills
```

Then install **VidNavigator** from `/plugins`, and set `VIDNAVIGATOR_API_KEY` as above.

</details>

<details>
<summary>Already have a skill named <code>watch</code> or <code>search</code>?</summary>

Skills installed with `npx skills add` are stored by name, so a second skill with the same name replaces the first. Install only the one you want with `--skill`, for example `npx skills add vidnavigator/skills -g --skill tiktok-live`. In Claude Code the plugin keeps its own names (`/vidnavigator:watch`), so nothing is replaced.

</details>

### Claude on the web, desktop and mobile

No API key to copy: Claude signs you in to your VidNavigator account.

1. In Claude, open **Customize → Connectors**, select **Add**, then **Add custom connector**.
2. Enter a name and the address `https://api.vidnavigator.com/mcp/`. Keep the sign-in choice that Claude detects, add no request header, and click **Add**.
3. Click **Connect**, sign in to VidNavigator and click **Allow**.

Claude then has every VidNavigator tool, in the browser, in Claude Desktop and in the mobile apps. It gets read access on the credits of your plan, and the connection can be ended at any time in [Studio → API](https://vidnavigator.com/studio/api).

<details>
<summary>Claude Desktop with an API key instead</summary>

Open **Settings → Developer → Edit Config**, add the server to `claude_desktop_config.json`, and restart Claude Desktop. It needs Node.js 18 or later:

```json
{
  "mcpServers": {
    "vidnavigator": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://api.vidnavigator.com/mcp/", "--header", "X-API-Key:YOUR_API_KEY"]
    }
  }
}
```

Keep `X-API-Key:` and the key together, with no space.

</details>

### ChatGPT

No API key to copy: ChatGPT signs you in to your VidNavigator account.

1. On [chatgpt.com/plugins](https://chatgpt.com/plugins), select **+**, then **Add custom MCP server**.
2. Name it VidNavigator, enter the server URL `https://api.vidnavigator.com/mcp/`, and choose **OAuth** for authentication.
3. Accept the warning, select **Create as a plugin**, then install it.
4. In a conversation, use the plugin: sign in to VidNavigator and click **Allow**.

### Any other MCP client

The MCP server is hosted at `https://api.vidnavigator.com/mcp/` and takes the key in an `X-API-Key` header (or `Authorization: Bearer`). A client that supports OAuth can leave the key out: the server then asks it to sign the user in. The exact file depends on the client; for most of them:

```json
{
  "mcpServers": {
    "vidnavigator": {
      "type": "http",
      "url": "https://api.vidnavigator.com/mcp/",
      "headers": { "X-API-Key": "YOUR_API_KEY" }
    }
  }
}
```

Setup for each client, and the list of tools: [docs.vidnavigator.com/mcp-server](https://docs.vidnavigator.com/mcp-server).

## How it works

Each skill names the VidNavigator tools to call, and runs them in whichever way your agent offers:

- **MCP tools**, when the VidNavigator MCP server is connected (the Claude Code plugin sets it up).
- **A bundled command-line script** otherwise: `scripts/vn.mjs`, one file with no dependency, shipped inside each skill. It needs Node.js 18 or later and calls the same tools over HTTPS.

This is what a skill gets back for the first video ever posted on YouTube:

```console
$ node skills/watch/scripts/vn.mjs get_video_transcript \
    video_url="https://www.youtube.com/watch?v=jNQXAC9IVRw" --transcript zoo.txt
Transcript written to zoo.txt (about 55 words).

$ cat zoo.txt
Title: Me at the zoo
Channel: jawed
URL: https://www.youtube.com/watch?v=jNQXAC9IVRw
Duration: 0:19
Published: 2005-04-24

[0:01] All right, so here we are, in front of the elephants the cool thing about these guys is that
they have really... really really long trunks and that's cool (baaaaaaaaaaahhh!!) and that's pretty
much all there is to say
```

The only server contacted is `api.vidnavigator.com`. Your key is read from `VIDNAVIGATOR_API_KEY` or from `~/.config/vidnavigator/api_key`, and is sent nowhere else. Check your setup at any time:

```bash
node skills/watch/scripts/vn.mjs setup
```

## What it reads, and what it does not

- It reads what is **said** in a video (the platform's captions, or speech-to-text when there are none) and the video's details: title, creator, date, views, likes.
- It does **not** look at the picture. Text on screen, charts and silent footage are out of reach. If you need frames, [claude-video](https://github.com/bradautomates/claude-video) extracts them on your machine with yt-dlp and ffmpeg.
- A private, deleted, age-restricted or region-locked video returns an error, which the agent reports as it is.
- A YouTube video without captions cannot be transcribed. Every other platform can.

## Credits

Every call draws from your VidNavigator [credits](https://vidnavigator.com/pricing), like the same call through the API. The skills are written to spend little: they bound every search, do not fetch a transcript twice, and tell you the size of a large run before starting it. Ask your agent "how many VidNavigator credits do I have left?" at any time.

## For developers

VidNavigator is also a REST API with [Python](https://github.com/vidnavigator/vidnavigator-python) and [JavaScript](https://github.com/vidnavigator/vidnavigator-js) SDKs: [docs.vidnavigator.com](https://docs.vidnavigator.com). The `vidnavigator-api` skill teaches your coding agent to use them.

Working on this repository (`chatgpt/` holds the package for the ChatGPT plugin directory, see [its README](chatgpt/README.md)):

```bash
node scripts/check.mjs      # validates every skill and the manifests
node scripts/sync-cli.mjs   # after editing skills/watch/scripts/vn.mjs, copies it into the other skills
```

A skill is installed as one folder, so each skill carries its own copy of the script. The version is written in `.claude-plugin/plugin.json`, in `.codex-plugin/plugin.json` and in each skill's `metadata.version`; the check fails when they differ.

## Support

- Documentation: [docs.vidnavigator.com](https://docs.vidnavigator.com)
- Issues: [github.com/vidnavigator/skills/issues](https://github.com/vidnavigator/skills/issues)
- Email: support@vidnavigator.com

## License

[MIT](LICENSE)
