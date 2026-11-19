---
name: watch
description: Watches an online video - reads what is said and what is shown, scene by scene, with the text on screen - and answers from both, with timestamps. Works on YouTube, TikTok, Instagram, X/Twitter, Facebook, Vimeo, Dailymotion, Loom, Rumble and Snapchat links, without downloading anything. Use when the user shares a video link, or asks to watch, summarize, describe, transcribe, quote, translate, take notes from or fact-check a video, or asks what a video says or shows. Called as /watch <link> followed by an optional question.
license: MIT
compatibility: Needs a VidNavigator API key, and either the VidNavigator MCP server or Node.js 18+ with network access to api.vidnavigator.com.
metadata:
  author: VidNavigator
  version: "1.2.0"
---

# Watch a video

Usage: `/watch <link> [question]`. Without a question, summarize the video.

Get what the video says and what it shows from VidNavigator, then answer from both. Nothing is downloaded and no local tool is needed: no yt-dlp, no ffmpeg, no speech-to-text or vision model.

## Calling VidNavigator

Each step names a VidNavigator tool and its arguments. Call it in whichever way this session offers:

- **MCP tools.** If tools such as `watch_video` are in your tool list (their names may carry a prefix, for example `mcp__vidnavigator__watch_video`), call them directly. A tool that starts a background task returns a `task_id` and a `task_type`: call `get_task_status` with both until `task_status` is `completed` or `failed`. That call waits for the task, so make it again whenever it still answers `processing`.
- **The bundled CLI.** Otherwise run the script that sits beside this file, where `SKILL_DIR` is the directory containing this SKILL.md:

  ```bash
  node "$SKILL_DIR/scripts/vn.mjs" watch_video video_url="https://www.youtube.com/watch?v=..." --transcript video.txt
  ```

  Same tools, same arguments, written `key=value`. Quote a value that holds spaces, `&` or `?`. The CLI waits for background tasks itself. `--transcript FILE` writes what is said and what is shown as text, in the order of the video: a `[m:ss]` timestamp at each block, and `(picture)` on the lines that describe a scene. It also prints the video's details. Use it for every video, then read the file. It needs Node.js 18+ and the user's API key. When it reports that no key was found, give the user its instructions and stop. `node "$SKILL_DIR/scripts/vn.mjs" help <tool>` lists a tool's arguments.

## Steps

1. **Watch the video.** Call `watch_video` with `video_url`. It runs as a background task (`task_type` `watch`) and returns the video's details (title, channel, duration, views, publication date), the transcript as timestamped segments, and `scenes`: for each one its `start` and `end` in seconds, a `description` of the picture and `on_screen_text`, the text readable on screen.
   - `detail` sets how closely the picture is followed. Leave the default (`auto`); use `high` when the question is about something brief or small on screen, `low` when a rough idea of the picture is enough.
   - When the transcript is already in the conversation or in a file, pass `include_transcript=false` to get the scenes alone.
   - An Instagram carousel or a Snapchat highlight holds several videos: `?img_index=N` in the link selects one (the first by default).
2. **No speech?** A video without speech is not an error: its scenes come back with `transcript_error` saying why. Answer from the scenes and say that nothing is said.
3. **Only the words are wanted?** When the request is only for the text of what is said (the full transcript of a talk, or its translation), the picture adds nothing: call `get_video_transcript` with `video_url` instead. If it fails with `transcript_not_available`, or for Instagram, call `transcribe_video` (speech-to-text on every platform, YouTube included, `task_type` `transcribe`).
4. **Answer from both.** Summaries, notes, quotes, translations, descriptions and lists of claims are yours to write from the transcript and the scenes. When it matters, say where a fact comes from: what the video says, what it shows, or the text on screen, quoted as written. Do not call `analyze_video` for work you can do from what you already hold.
5. **Point to the moment.** Give timestamps as `m:ss`. For YouTube, link them: `https://youtu.be/VIDEO_ID?t=SECONDS`.

## What this reads, and what it does not

- It reads what is **said** (the platform's captions, or speech-to-text), what is **shown** (people, setting, action, objects) and the **text on screen** (captions, titles, signs), plus the video's details.
- The picture is described scene by scene: something visible for an instant can be missed. Before answering that something is not in the video, watch it again with `detail=high`.
- A description says what is visible. Do not give a person's name from the picture alone: take it from the speech, the text on screen or the video's details.
- A live stream, or a clip of a few seconds, has no picture to read (`frames_not_available`), and a video longer than 2 hours is refused except on YouTube (`video_too_long`): read the transcript instead (step 3) and say that you could only read the speech.
- A private, deleted, age-restricted or region-locked video returns an error. Report its message as it is, without guessing the content.
- Quote the transcript and the text on screen exactly. Captions carry mistakes on names and numbers: when a figure matters, say where it comes from.

## Several videos

Videos that do not depend on each other can be watched in parallel. To find a video rather than watch one, use the `search` skill; to fill a table from many videos, the `video-dataset` skill.

## Credits

Every call uses the user's VidNavigator credits; checking a task is free. Watching costs more than reading a transcript: the picture is charged by the number of frames analyzed, which grows with the length of the video and with how often its picture changes. Do not watch again a video whose scenes are already in the conversation or in a file. Call `get_usage` only when the user asks for their balance.
