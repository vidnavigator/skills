---
name: vidnavigator-api
description: Writes code that uses the VidNavigator API and its Python and JavaScript SDKs - transcripts and speech-to-text for YouTube, TikTok, Instagram, X/Twitter, Facebook and other video links, structured data extraction from videos, YouTube search, TikTok keyword search, profiles and LIVE rooms, and uploaded audio or video files. Use when the user is building an app, script, pipeline or agent that needs video transcripts or social-video data, asks how to call VidNavigator, or has code that imports the vidnavigator package.
license: MIT
metadata:
  author: VidNavigator
  version: "1.0.1"
---

# Build with the VidNavigator API

One API for what is said in online videos and for social-video data. Use the official SDK when the project is in Python or JavaScript/TypeScript; call the HTTP API otherwise.

- Base URL: `https://api.vidnavigator.com/v1`
- Authentication: the header `X-API-Key: <key>`. Keys are created at https://vidnavigator.com/studio/api.
- Read the key from the environment variable `VIDNAVIGATOR_API_KEY`. Never write a key into source code or commit one.
- Documentation: https://docs.vidnavigator.com. Every page is also served as Markdown by adding `.md` to its address, and https://docs.vidnavigator.com/llms.txt lists them all. Read the page of an endpoint before writing code against it: it is the reference for parameters and response fields.

## Install

```bash
pip install vidnavigator            # Python 3.8+; add the extra for asyncio: pip install "vidnavigator[async]"
npm install vidnavigator            # JavaScript and TypeScript
```

```python
from vidnavigator import VidNavigatorClient
client = VidNavigatorClient()  # reads VIDNAVIGATOR_API_KEY
```

```ts
import { VidNavigatorClient } from 'vidnavigator';
const vn = new VidNavigatorClient({ apiKey: process.env.VIDNAVIGATOR_API_KEY! });
```

## Which call

| Need | Python | JavaScript | HTTP |
|---|---|---|---|
| Captions of a video (YouTube, TikTok, X, Facebook, Vimeo, Dailymotion, Loom, Snapchat) | `client.get_transcript(video_url=...)` | `vn.getTranscript({ video_url })` | `POST /transcript` |
| Speech-to-text when there are no captions (Instagram, and any platform but YouTube) | `client.transcribe_video(video_url=...)` | `vn.transcribe(url)` | `POST /transcribe/async` |
| Summary, people, subjects, or an answer to a question | `client.analyze_video(video_url=..., query=...)` | `vn.analyzeVideo({ video_url, query })` | `POST /analyze/video` |
| Your own fields out of a video, as JSON | `client.extract_video_data(video_url=..., schema=...)` | `vn.extractVideo({ video_url, schema })` | `POST /extract/video/async` |
| YouTube videos for a query, ranked, with the best moment | `client.search_youtube(query=..., max_results=...)` | `vn.searchYouTube({ query, max_results })` | `POST /youtube/search` |
| TikTok videos for a keyword | `client.search_tiktok(query=..., max_results=...)` | `vn.tiktokSearch({ query, max_results })` | `POST /tiktok/search` |
| The videos of a TikTok account | `client.scrape_tiktok_profile(profile_url=...)` | `vn.tiktokProfile(profileUrl)` | `POST /tiktok/profile` |
| TikTok LIVE rooms broadcasting now | `client.search_tiktok_live(query=..., country=...)` | `vn.tiktokLiveSearch({ query, country })` | `POST /tiktok/live/search` |
| One TikTok LIVE room, with its latest comments | `client.get_tiktok_live_room(username=..., include_comments=True)` | `vn.getTikTokLiveRoom({ username, include_comments: true })` | `POST /tiktok/live/room` |
| The claim made in a post on X | `client.get_tweet_statement(tweet_id=...)` | `vn.tweetStatement(tweetId)` | `POST /tweet/statement/async` |
| Your own audio or video file | `client.upload_file(path, wait_for_completion=True)` | `vn.uploadFile({ filePath, wait_for_completion: true })` | `POST /upload/file` |
| Credits left | `client.get_usage()` | `vn.getUsage()` | `GET /usage` |

Captions first, speech-to-text second: try the transcript, and fall back to transcription when it is not available.

```python
from vidnavigator import NotFoundError

def read_video(url: str) -> str:
    try:
        return client.get_transcript(video_url=url, transcript_text=True).data.transcript
    except NotFoundError:  # no captions; Instagram never has any
        return client.transcribe_video(video_url=url, transcript_text=True).data.transcript
```

Without `transcript_text`, `transcript` is a list of segments with `text`, `start` and `end` in seconds; the video's details are in `video_info`. A YouTube video without captions cannot be transcribed.

## Background jobs

Speech-to-text, extraction, tweet analysis and the three TikTok searches run as jobs on VidNavigator's servers. The SDK methods above submit the job, wait and return the result, for media of any length. To run many at once, submit them all first, then collect:

```python
jobs = [client.submit_transcribe_video(video_url=url) for url in urls]
for url, job in zip(urls, jobs):
    try:
        print(url, job.result().data.transcript)
    except VidNavigatorError as exc:
        print(url, "failed:", exc.error_code)
```

```ts
const jobs = await Promise.all(urls.map((url) => vn.transcribe.submit(url)));
const results = await Promise.allSettled(jobs.map((job) => job.result()));
```

- Python: every job method has a `submit_*` twin that returns a `Job` (`task_id`, `status()`, `done()`, `result()`); `client.resume_job(job_type, task_id)` rebuilds one later.
- JavaScript: `vn.transcribe`, `vn.extractVideo`, `vn.tweetStatement`, `vn.tiktokProfile`, `vn.tiktokSearch` and `vn.tiktokLiveSearch` each have `.submit(...)` and `.resume(task_id)`.
- An account runs a limited number of jobs at once: past it, a submit raises `TooManyActiveJobsError` and creates nothing. For a large batch, keep a bounded number running and submit the next one as each finishes.
- Results are kept for one hour after a job finishes. Store the `task_id` when the process may restart.
- Over HTTP: the submit route answers `202` with a `task_id`; poll `GET` on the same path with the id (`GET /transcribe/{task_id}`, `GET /tiktok/search/{task_id}`...) until `task_status` is `completed` or `failed`. The synchronous `POST /transcribe` and `POST /extract/video` refuse media longer than 10 minutes: use the `/async` routes.
- A job can call a webhook when it finishes instead of being polled (`webhook_url`). Verify the signature with `construct_webhook_event` (Python) or `constructWebhookEvent` (JavaScript), on the raw request body: https://docs.vidnavigator.com/webhooks.md

## Extraction schema

The schema is VidNavigator's own format, not JSON Schema: each field name maps to `{"type", "description"}`. Types are capitalized: `String`, `Number`, `Integer`, `Boolean`, `Enum` (with `enum`, the allowed values), `Array` (with `items`, a field definition) and `Object` (with `properties`). At most 10 fields per level and 3 levels. The description is the instruction the extraction follows.

```python
resp = client.extract_video_data(
    video_url=url,
    schema={
        "product": {"type": "String", "description": "Product the video is about. Empty if none."},
        "verdict": {"type": "Enum", "enum": ["positive", "mixed", "negative"], "description": "The creator's overall opinion."},
        "claims": {"type": "Array", "description": "Factual claims made about the product.",
                   "items": {"type": "String", "description": "One claim, as one short sentence"}},
    },
)
print(resp.data)        # the extracted fields
print(resp.video_info)  # title, channel, duration, views...
```

An invalid schema is refused with `invalid_schema` before anything is billed.

## Errors

Every SDK error extends `VidNavigatorError` and carries `status_code` and a machine-readable `error_code`: branch on the code, not on the message.

| Status | Class | Meaning |
|---|---|---|
| 400 | `BadRequestError` | Invalid parameters or schema |
| 401 | `AuthenticationError` | Missing or invalid API key |
| 402 | `PaymentRequiredError` | Not enough credits |
| 403 | `AccessDeniedError` | The content needs a login or an age check |
| 404 | `NotFoundError` | No transcript, no such video or file, unknown or expired `task_id` |
| 429 | `RateLimitExceeded` (Python), `RateLimitExceededError` (JavaScript); `TooManyActiveJobsError` | Too many requests; too many jobs running |
| 451 | `GeoRestrictedError` | Content not available in the region |
| 503 | `SystemOverloadError` | Temporary overload: retry after `retry_after_seconds` |

Waiting for a job that outlasts its timeout raises `JobTimeoutError` (Python) or `TaskTimeoutError` (JavaScript): the job keeps running and can be resumed with its `task_id`.

## Good practice

- The API reads what is **said** in a video and its details, not the picture.
- Test with one short video before a batch, and bound every search with `max_results`.
- Pass `include_usage=True` to see what a call consumed; what each operation costs: https://docs.vidnavigator.com/api-reference/usage-costs.md
- Rate limits per endpoint: https://docs.vidnavigator.com/api-reference/rate-limiting.md. On `429`, wait and retry with backoff.
- TikTok search takes a `country` (default `gb`, `us` not available); TikTok LIVE search takes one too (default `us`).
- For an agent rather than code, the same operations are served as MCP tools at `https://api.vidnavigator.com/mcp/`: https://docs.vidnavigator.com/mcp-server.md
