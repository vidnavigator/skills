---
name: video-dataset
description: Builds a spreadsheet from many online videos - finds them (a TikTok search, a TikTok profile, a YouTube search or a list of links), extracts the same fields from what is said in each one, and writes a CSV or JSON file with one row per video. Use when the user asks for a CSV, a table, a spreadsheet or a dataset built from several videos, for example the product, the price, the claims or the creator's opinion in the most liked TikToks about a topic, or wants to compare what creators say, track mentions of a brand or product, or collect structured data from videos at volume.
license: MIT
compatibility: Needs a VidNavigator API key, and either the VidNavigator MCP server or Node.js 18+ with network access to api.vidnavigator.com.
metadata:
  author: VidNavigator
  version: "1.0.0"
---

# Build a dataset from videos

Find the videos, extract the same fields from each one, write one row per video. The fields come from what is said in each video, read by `extract_video_data`: a search result's caption is not a source for them.

## Calling VidNavigator

Each step names a VidNavigator tool and its arguments. Call it in whichever way this session offers:

- **MCP tools.** If tools such as `extract_video_data` are in your tool list (their names may carry a prefix, for example `mcp__vidnavigator__extract_video_data`), call them directly. A tool that starts a background task returns a `task_id` and a `task_type`: call `get_task_status` with both until `task_status` is `completed` or `failed`. That call waits for the task, so make it again whenever it still answers `processing`. TikTok results come 50 per page: pass `pagination.next_cursor` as `cursor` for the next page.
- **The bundled CLI.** Otherwise run the script that sits beside this file, where `SKILL_DIR` is the directory containing this SKILL.md:

  ```bash
  node "$SKILL_DIR/scripts/vn.mjs" extract_video_data video_url="https://www.tiktok.com/@user/video/123" schema=@schema.json --out rows/123.json
  ```

  Same tools, same arguments, written `key=value`. Quote a value that holds spaces, `&` or `?`. An object such as `schema` is read from a file: `schema=@schema.json`. The CLI waits for background tasks and gathers every page of a search. `--out FILE` writes the full result to a file and prints what it holds. It needs Node.js 18+ and the user's API key. When it reports that no key was found, give the user its instructions and stop. `node "$SKILL_DIR/scripts/vn.mjs" help <tool>` lists a tool's arguments.

## 1. Settle the scope

You need three things. Ask only for what the request leaves open, and propose the columns yourself from the user's goal.

- **Source**: a TikTok keyword search, a TikTok profile, a YouTube search, or links the user already has.
- **Size**: how many videos. Above 50 videos, state the size of the run and wait for a go-ahead: every video uses credits.
- **Columns**: the fields to extract, and the file format (CSV by default).

## 2. Find the videos

- **TikTok, by keyword**: `search_tiktok`. Write the query as a TikTok user would (1 to 4 keywords). Always set `max_results`. Popular videos: `sort_by=most_liked`, with `published_within` for a period. Recent videos: `after_datetime` alone. Set `country` (two letters; `us` is not available) when the user names a market.
- **TikTok, one creator**: `scrape_tiktok_profile` with `profile_url` and `max_posts`.
- **YouTube**: `search_videos` with `query` and `max_results`. Each result already carries a summary and its best moment.
- **Links from the user**: nothing to search.

Search results already hold facts to keep as columns: the link, the creator, the publication date, views and likes.

## 3. Write the schema once

`extract_video_data` takes a `schema`: each field name mapped to `{"type": ..., "description": ...}`. Types are capitalized: `String`, `Number`, `Integer`, `Boolean`, `Enum` (with an `enum` list of allowed values), `Array` (with `items`, a field definition) and `Object` (with `properties`). At most 10 fields per level and 3 levels. The description is what the extraction follows, so make it precise, and say what to return when the video does not give the information.

```json
{
  "product": { "type": "String", "description": "Product the video is about. Empty if none." },
  "price_usd": { "type": "Number", "description": "Price stated in the video, in US dollars. Null if no price is said." },
  "verdict": { "type": "Enum", "enum": ["positive", "mixed", "negative"], "description": "The creator's overall opinion of the product." },
  "claims": { "type": "Array", "description": "Each factual claim made about the product.", "items": { "type": "String", "description": "One claim, as one short sentence" } }
}
```

Use the same schema for every video of the run.

## 4. Extract

1. Run **one** video first: `extract_video_data` with `video_url`, `schema` and, when useful, `what_to_extract` (one sentence of guidance). It runs as a background task (`task_type` `extract_video`) and returns the fields under `result`, with the video's details under `video_info`. Check that the fields come back as intended, and adjust the schema now if they do not.
2. Then run the rest, at most 10 at a time. The first call with a new schema prepares it for the following ones, so do not start the batch before the first video has finished.

Videos without captions are transcribed automatically, except on YouTube, where a video without captions fails: record the failure and move on.

## 5. Write the file

- One row per video: the facts from the search (link, creator, date, views, likes), then the extracted fields.
- An `error` column for the videos that failed, with the message. Never fill a missing value with a guess: leave it empty.
- CSV: quote fields that contain commas, quotes or line breaks; join array values with ` | `.
- Save it in the working directory under a name that says what it is (`creatine-gummies-tiktok.csv`), and tell the user where it is, how many videos succeeded and how many failed.

For more than a few dozen videos, write a short script that loops over the links and appends each row as it arrives, rather than holding every result in the conversation.

## What the fields come from

Extraction reads what is **said** in a video (captions, or speech-to-text) and its details. It does not see the picture: a price shown on screen but never spoken is not found.

## Credits

Searches are billed by the number of videos returned, extraction by the length of the transcript. Checking a task is free. `get_usage` gives the balance: call it when the user asks, or before a run of several hundred videos.
