---
name: watch
description: Reads what is said in an online video and answers from it, with timestamps. Works on YouTube, TikTok, Instagram, X/Twitter, Facebook, Vimeo, Dailymotion, Loom, Rumble and Snapchat links, on videos of any length, without downloading anything. Use when the user shares a video link, or asks to watch, summarize, transcribe, quote, translate, take notes from or fact-check a video, or asks what a video says. Called as /watch <link> followed by an optional question.
license: MIT
compatibility: Needs a VidNavigator API key, and either the VidNavigator MCP server or Node.js 18+ with network access to api.vidnavigator.com.
metadata:
  author: VidNavigator
  version: "1.0.1"
---

# Watch a video

Usage: `/watch <link> [question]`. Without a question, summarize the video.

Get the video's transcript from VidNavigator, then answer from that text. Nothing is downloaded and no local tool is needed: no yt-dlp, no ffmpeg, no speech-to-text model.

## Calling VidNavigator

Each step names a VidNavigator tool and its arguments. Call it in whichever way this session offers:

- **MCP tools.** If tools such as `get_video_transcript` are in your tool list (their names may carry a prefix, for example `mcp__vidnavigator__get_video_transcript`), call them directly. A tool that starts a background task returns a `task_id` and a `task_type`: call `get_task_status` with both until `task_status` is `completed` or `failed`. That call waits for the task, so make it again whenever it still answers `processing`.
- **The bundled CLI.** Otherwise run the script that sits beside this file, where `SKILL_DIR` is the directory containing this SKILL.md:

  ```bash
  node "$SKILL_DIR/scripts/vn.mjs" get_video_transcript video_url="https://www.youtube.com/watch?v=..." --transcript transcript.txt
  ```

  Same tools, same arguments, written `key=value`. Quote a value that holds spaces, `&` or `?`. The CLI waits for background tasks itself. `--transcript FILE` writes the transcript as text with a `[m:ss]` timestamp at each block and prints the video's details: use it for every transcript, then read the file. It needs Node.js 18+ and the user's API key. When it reports that no key was found, give the user its instructions and stop. `node "$SKILL_DIR/scripts/vn.mjs" help <tool>` lists a tool's arguments.

## Steps

1. **Get the transcript.** Call `get_video_transcript` with `video_url`. It returns the video's details (title, channel, duration, views, publication date) and the transcript as timestamped segments.
   - Instagram has no captions: go straight to step 2.
   - Pass `language` (two letters) when the user wants a specific caption language.
2. **No transcript?** When the call fails with `transcript_not_available`, or for Instagram, call `transcribe_video` with `video_url`. It runs speech-to-text on every platform except YouTube, on videos of any length, as a background task (`task_type` `transcribe`).
   - A YouTube video without captions cannot be transcribed: say so.
   - An Instagram carousel or a Snapchat highlight holds several videos: `all_videos=true` reads them all.
3. **Answer from the text.** Summaries, notes, quotes, translations and lists of claims are yours to write from the transcript. Do not call `analyze_video` for work you can do from a transcript you already hold.
4. **Point to the moment.** Give timestamps as `m:ss`. For YouTube, link them: `https://youtu.be/VIDEO_ID?t=SECONDS`.

## What this reads, and what it does not

- It reads what is **said** (the platform's captions, or speech-to-text) and the video's details. It does not see the picture: text on screen, charts, slides and silent footage are out of reach. When the question is about something only visible, say that you can only read the speech.
- A private, deleted, age-restricted or region-locked video returns an error. Report its message as it is, without guessing the content.
- Quote the transcript exactly. Captions carry mistakes on names and numbers: when a figure matters, say it comes from the captions.

## Several videos

Videos that do not depend on each other can be read in parallel. To find a video rather than read one, use the `search` skill; to fill a table from many videos, the `video-dataset` skill.

## Credits

Every call uses the user's VidNavigator credits; checking a task is free. Do not fetch again a transcript that is already in the conversation or in a file. Call `get_usage` only when the user asks for their balance.
