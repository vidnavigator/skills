---
name: search
description: Searches online videos - TikTok by keyword (latest, most liked, by country and period) or by account, and YouTube for the videos and the exact passage that match a request, including videos for or against a claim or a post on X/Twitter. Use when the user asks to search or find videos, asks what is trending or viral on TikTok about a topic, wants the videos of a TikTok account, wants a video where someone says or explains something, or wants video sources for a statement. Called as /search tiktok <keywords> or /search youtube <request>. For a table of what the videos say (products, prices, claims, opinions), use the video-dataset skill instead; for TikTok LIVE rooms, the tiktok-live skill.
license: MIT
compatibility: Needs a VidNavigator API key, and either the VidNavigator MCP server or Node.js 18+ with network access to api.vidnavigator.com.
metadata:
  author: VidNavigator
  version: "1.0.1"
---

# Search videos

Usage: `/search tiktok <keywords>` or `/search youtube <what to find>`. The source can also come from the request itself:

| The request | Source |
|---|---|
| Starts with `tiktok`, or names TikTok, a hashtag, a TikTok account, a trend or what is viral | [TikTok](#tiktok) |
| Starts with `youtube`, or asks for a video where someone says, explains or shows something, or for videos for or against a statement | [YouTube](#youtube) |
| A link to a post on X/Twitter to check | [A post on X/Twitter](#a-post-on-xtwitter) |

When the request names no source and fits both, search YouTube for something said or explained and TikTok for what is popular, and say which one you searched. The LIVE rooms broadcasting right now are the `tiktok-live` skill.

## Calling VidNavigator

Each step names a VidNavigator tool and its arguments. Call it in whichever way this session offers:

- **MCP tools.** If tools such as `search_tiktok` are in your tool list (their names may carry a prefix, for example `mcp__vidnavigator__search_tiktok`), call them directly. A tool that starts a background task returns a `task_id` and a `task_type`: call `get_task_status` with both until `task_status` is `completed` or `failed`. That call waits for the task, so make it again whenever it still answers `processing`. TikTok results come 50 per page: pass `pagination.next_cursor` as `cursor` for the next page.
- **The bundled CLI.** Otherwise run the script that sits beside this file, where `SKILL_DIR` is the directory containing this SKILL.md:

  ```bash
  node "$SKILL_DIR/scripts/vn.mjs" search_tiktok query="creatine gummies" sort_by=most_liked published_within=this_week max_results=20 --out tiktok.json
  node "$SKILL_DIR/scripts/vn.mjs" search_videos query="how mRNA vaccines work" purpose=explain max_results=5 --out youtube.json
  ```

  Same tools, same arguments, written `key=value`. Quote a value that holds spaces, `&` or `?`. The CLI waits for background tasks and gathers every page. `--out FILE` writes the full result to a file and prints what it holds: use it, then read the file. It needs Node.js 18+ and the user's API key. When it reports that no key was found, give the user its instructions and stop. `node "$SKILL_DIR/scripts/vn.mjs" help <tool>` lists a tool's arguments.

## TikTok

### By keyword: `search_tiktok`

Write `query` the way a TikTok user types it: 1 to 4 keywords or a hashtag word, not a sentence. For a non-English-speaking country, search in that country's language.

Always set `max_results` to what the request needs (20 for a quick look, 100 for an analysis). Then pick the filters from the request, and nothing more:

| The user asks for | Set |
|---|---|
| The latest videos, "since Monday", "last 2 hours" | `after_datetime` only (`YYYY-MM-DD` or an ISO datetime with timezone). Leave `sort_by` and `published_within` unset. |
| Popular or viral videos | `sort_by=most_liked`, or a floor with `min_likes` / `min_views` |
| Popular over a period | `sort_by=most_liked` with `published_within`: `past_24_hours`, `this_week`, `this_month`, `last_3_months` or `last_6_months` |
| A topic, with no time or popularity angle | the query alone |
| A market | `country`: two letters, about 130 countries, default `gb`. `us` is not available. |

Do not combine `published_within` with `after_datetime`. Leave `parallel_search_slices` alone unless the user needs more than about 120 videos.

Each result has `url`, `description`, `hashtags`, `published_at`, `duration`, `author` (`unique_id`, `nickname`), `stats` (`views`, `likes`, `comments`, `shares`, `collects`) and `music`.

### One account: `scrape_tiktok_profile`

Pass `profile_url` (`https://www.tiktok.com/@username`) and bound the run with `max_posts`, and with `after_datetime` for a period. `min_likes` and `max_likes` filter by popularity. Each video has `url`, `description`, `published_at`, `duration`, `views`, `likes`, `comments` and `reposts`.

### Answer

- Give a table: link, creator, date, views, likes, and the first words of the caption. Keep TikTok's numbers as they are.
- State the query, the country and the period you searched, and how many videos came back. A search can return few or no videos: say so instead of widening it silently.
- Counts are what TikTok showed at the time of the search.
- A caption is what the creator typed under the video, not what is said in it. For anything about the content of the videos (what they claim, recommend, review or explain), read the videos: `get_video_transcript` for one or two (the `watch` skill), the `video-dataset` skill for a table. Never fill a column about a video's content from its caption.

## YouTube

VidNavigator searches YouTube, reads the transcript of each candidate and ranks them. Every result comes back with a summary and the timestamp of the passage that best matches the request.

1. **Write the query** as the thing to find, in plain words: `Neil deGrasse Tyson explains gravity`, `what is said about the 2008 bailout`. At least 3 characters.
2. **Call `search_videos`** with `query` and:
   - `max_results`: always set it. Each candidate is read and analysed, so this is what the search costs. 5 is enough for "find me a video", 10 to 15 for a survey of what exists.
   - `purpose`: `support` or `oppose` for videos that argue for or against the query taken as a claim; `explain`, `example` or `illustrate` for teaching material; leave it out otherwise.
   - `focus`: `relevance` by default, `recency` for the latest videos, `popularity` for the most viewed, `brevity` for the shortest.
   - `start_year`, `end_year` and `duration` (maximum length, in seconds) when the user sets a period or wants short videos.
   - `use_enhanced_search=true` only when a first search missed: it is slower and finds more.
3. **Read the results.** Each one has `title`, `url`, `channel`, `published_date`, `duration`, `views`, `relevance_score`, `transcript_summary`, `timestamp` (seconds), `relevant_text` (the passage at that timestamp) and `query_relevance` (why it matches).
4. **Answer with the moment.** Give the title, the channel, the date, one line on why it matches, and a link that opens at the passage: `https://youtu.be/VIDEO_ID?t=SECONDS`. Quote `relevant_text` when the user asked for what was said.

A search that returns nothing useful is an answer: say so, and offer one other wording. Do not run searches in a loop. To go deeper into one result, read its full transcript (the `watch` skill).

## A post on X/Twitter

1. Call `get_tweet_statement` with `tweet_id`: the digits at the end of the post's link. It reads the post, the post it quotes and its attached video or images, and returns `final_statement` (the claim, in one piece) with `detailed_analysis`, `topics`, `entities`, `claim_type` and `tone`. It runs as a background task (`task_type` `tweet_statement`).
2. Show the user the claim as you understood it.
3. Call `search_videos` twice with `final_statement` as the `query`: once with `purpose=support`, once with `purpose=oppose`, each with a small `max_results`.
4. Report what each side says, with the linked moments. You report what the videos say: do not turn it into a verdict on the claim, and say when one side returned nothing.

## Credits

A TikTok search is billed by the number of videos TikTok returned, including those the filters removed, and a profile by the page: `max_results`, `max_posts` and a date bound are what keep a run small. A YouTube search is the most expensive call here: it is billed for each candidate it reads, plus one analysis, so keep `max_results` low and tell the user before running more than two searches for one question. Checking a task is free.
