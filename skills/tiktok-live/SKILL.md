---
name: tiktok-live
description: Finds the TikTok LIVE rooms broadcasting right now for a keyword, in a given country, and reads one LIVE room - whether a creator is live, how many people are watching, and the latest comments of the chat. Use when the user asks who is live on TikTok about a topic, which LIVEs are selling or showing something right now, whether a TikTok creator is live, or what viewers are saying in a TikTok LIVE. Called as /tiktok-live <keywords> or /tiktok-live @username.
license: MIT
compatibility: Needs a VidNavigator API key, and either the VidNavigator MCP server or Node.js 18+ with network access to api.vidnavigator.com.
metadata:
  author: VidNavigator
  version: "1.0.0"
---

# TikTok LIVE, right now

Usage: `/tiktok-live <keywords>` for the rooms that are live, `/tiktok-live @username` for one creator's room.

Two questions, two tools: which rooms are live for a keyword (`search_tiktok_live`), and what is happening in one room (`get_tiktok_live_room`). Both describe this moment: say when you looked.

## Calling VidNavigator

Each step names a VidNavigator tool and its arguments. Call it in whichever way this session offers:

- **MCP tools.** If tools such as `search_tiktok_live` are in your tool list (their names may carry a prefix, for example `mcp__vidnavigator__search_tiktok_live`), call them directly. The search starts a background task and returns a `task_id` and a `task_type`: call `get_task_status` with both until `task_status` is `completed` or `failed`. That call waits for the task, so make it again whenever it still answers `processing`.
- **The bundled CLI.** Otherwise run the script that sits beside this file, where `SKILL_DIR` is the directory containing this SKILL.md:

  ```bash
  node "$SKILL_DIR/scripts/vn.mjs" search_tiktok_live query=skincare country=gb max_results=20 --out live.json
  node "$SKILL_DIR/scripts/vn.mjs" get_tiktok_live_room username=nasa include_comments=true
  ```

  Same tools, same arguments, written `key=value`. Quote a value that holds spaces, `&` or `?`. The CLI waits for the search itself. `--out FILE` writes the full result to a file and prints what it holds. It needs Node.js 18+ and the user's API key. When it reports that no key was found, give the user its instructions and stop. `node "$SKILL_DIR/scripts/vn.mjs" help <tool>` lists a tool's arguments.

## Who is live: `search_tiktok_live`

- `query`: 1 to 3 keywords, as a TikTok user types them, in the country's language.
- `country`: two letters, about 110 countries, default `us`. Results are the rooms TikTok shows to that country.
- `max_results`: what the request needs. TikTok serves about 50 rooms for a keyword.
- Leave `include_stream_urls` off unless the user wants to play or record a stream.

Each room has `id`, `title`, `url`, `started_at`, `author` (`unique_id`, `nickname`, followers), `stats` (`viewers` now, `total_viewers`, `likes`, `comments`, `shares`), `hashtags`, `category` and `game_tags`. Rooms come in TikTok's own order: sort them by `stats.viewers` when the user asks for the biggest.

Zero rooms is a valid answer: nobody is live for that keyword in that country at this moment. Say so, and offer another keyword or country rather than retrying the same search.

## One room: `get_tiktok_live_room`

Pass exactly one of `username` (with or without `@`), `url` (`https://www.tiktok.com/@username/live`) or `room_id` (the `id` of a search result). It answers at once, with no task.

- **Is this creator live?** `room.status` is `live` or `ended`. A `username` returns the current LIVE, or the last one, with `ended_at`, when the creator is offline.
- **How is it going?** `room.stats.viewers`, `total_viewers` and `new_followers`, with `title`, `started_at`, `chat_enabled`, `subscribers_only` and `products` (the number of products on sale).
- **What is the chat saying?** Add `include_comments=true`: the latest comments (up to 50, newest first), the pinned comment, the intro text and the top viewers. TikTok keeps no older comments, and a room that has ended has none.

The likes, comment count and share count of a room come from the search, not from this call.

An account that does not exist, or has never been live, returns `live_not_found`: report it as it is.

## Answer

Give the room's link with every room you mention, and the time of your reading. To follow a room over time, the user has to ask again: nothing here watches a LIVE continuously.

## Credits

The search is billed by the number of rooms returned, a room once, and twice with its comments: ask for comments only when the user wants the chat. Checking a task is free.
