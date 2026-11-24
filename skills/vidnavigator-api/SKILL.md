---
name: vidnavigator-api
description: Writes code that uses the VidNavigator API and its Python and JavaScript SDKs - transcripts and speech-to-text for YouTube, TikTok, Instagram, X/Twitter, Facebook and other video links, summaries, answers to questions and structured data extracted from videos, YouTube search, TikTok keyword search, profiles and LIVE rooms, and uploaded audio or video files. Use when the user is building an app, script, pipeline or agent that needs video transcripts or social-video data, asks how to call VidNavigator, or has code that imports the vidnavigator package.
license: MIT
metadata:
  author: VidNavigator
  version: "1.3.0"
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
| Speech-to-text when there are no captions (Instagram, YouTube and every other platform) | `client.transcribe_video(video_url=...)` | `vn.transcribe(url)` | `POST /transcribe/async` |
| What a video shows, scene by scene, next to its transcript | `client.watch_video(video_url=...)` | `vn.watch(url)` | `POST /watch/async` |
| Summary, people, subjects, or an answer to a question | `client.extract_video_data(video_url=..., what_to_extract="a summary, and the answer to: ...")` | `vn.extractVideo({ video_url, what_to_extract })` | `POST /extract/video/async` |
| Your own fields out of a video, as JSON | `client.extract_video_data(video_url=..., schema=...)` | `vn.extractVideo({ video_url, schema })` | `POST /extract/video/async` |
| The same two, also from what the video shows (text on screen, little or no speech) | add `include_scenes=True` | add `include_scenes: true` | add `"include_scenes": true` |
| The same from your own uploaded file | `client.extract_file_data(file_id=..., what_to_extract=...)` | `vn.extractFileData({ file_id, what_to_extract })` | `POST /extract/file` |
| YouTube videos for a query, ranked, with the best moment | `client.search_youtube(query=..., max_results=...)` | `vn.searchYouTube({ query, max_results })` | `POST /youtube/search` |
| TikTok videos for a keyword | `client.search_tiktok(query=..., max_results=...)` | `vn.tiktokSearch({ query, max_results })` | `POST /tiktok/search` |
| The videos of a TikTok account | `client.scrape_tiktok_profile(profile_url=...)` | `vn.tiktokProfile(profileUrl)` | `POST /tiktok/profile` |
| TikTok LIVE rooms broadcasting now | `client.search_tiktok_live(query=..., country=...)` | `vn.tiktokLiveSearch({ query, country })` | `POST /tiktok/live/search` |
| One TikTok LIVE room, with its latest comments | `client.get_tiktok_live_room(username=..., include_comments=True)` | `vn.getTikTokLiveRoom({ username, include_comments: true })` | `POST /tiktok/live/room` |
| The claim made in a post on X | `client.get_tweet_statement(tweet_id=...)` | `vn.tweetStatement(tweetId)` | `POST /tweet/statement/async` |
| The same, also from what the post's video shows | `client.get_tweet_statement(tweet_id=..., include_scenes=True)` | `vn.tweetStatement({ tweet_id, include_scenes: true })` | add `"include_scenes": true` |
| Your own audio or video file | `client.upload_file(path, wait_for_completion=True)` | `vn.uploadFile({ filePath, wait_for_completion: true })` | `POST /upload/file` |
| The scenes of your own video file, analyzed once and kept with it | `client.upload_file(path, include_scenes=True)` or `client.analyze_file_scenes(file_id)` | `vn.uploadFile({ filePath, include_scenes: true })` or `vn.analyzeFileScenes(file_id)` | `POST /upload/file`, `POST /file/{file_id}/scenes` |
| Credits left | `client.get_usage()` | `vn.getUsage()` | `GET /usage` |

There is no separate analysis call: SDK 3.0.0 removed `analyze_video`, `submit_analyze_video` and `analyze_file` (JavaScript `analyzeVideo`, `analyzeFile` and `vn.analyze`), and the API no longer has `/analyze/video` or `/analyze/file`. Summaries and answers to questions come from extraction, as above. When you meet the old calls in existing code, replace them: [Moving from the analyze endpoints](https://docs.vidnavigator.com/guides/analyzing-videos.md).

Captions first, speech-to-text second: try the transcript, and fall back to transcription when it is not available.

```python
from vidnavigator import NotFoundError

def read_video(url: str) -> str:
    try:
        return client.get_transcript(video_url=url, transcript_text=True).data.transcript
    except NotFoundError:  # no captions; Instagram never has any
        return client.transcribe_video(video_url=url, transcript_text=True).data.transcript
```

Without `transcript_text`, `transcript` is a list of segments with `text`, `start` and `end` in seconds; the video's details are in `video_info`. A video without captions, on YouTube too, can be transcribed with speech-to-text.

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

## Extraction

Say what you want in plain words with `what_to_extract`, give the fields as a JSON Schema with `schema`, or both (the schema sets the fields, the text guides the extraction).

```python
resp = client.extract_video_data(
    video_url=url,
    what_to_extract="a three-sentence summary, the people mentioned, and the answer to: which price is quoted?",
)
print(resp.data)               # one field per thing asked for; a question the video does not answer is None
print(resp.evidence)           # per field: [FieldEvidence(start, end, in_)], in_ = "speech", "picture" or "post"
print(resp.extraction_schema)  # the fields written from the text: pass it as schema= to get the same ones next time
print(resp.video_info)         # title, channel, duration, views...
```

```ts
const { data, evidence, schema, video_info } = await vn.extractVideo({ video_url: url, what_to_extract: 'a summary, and the answer to: which price is quoted?' });
```

The schema is a standard JSON Schema whose root is an object, as Pydantic's `model_json_schema()` or Zod produce it. Each property has a lowercase `type` (`string`, `number`, `integer`, `boolean`, `array` with `items`, `object` with `properties`) and a `description`, the instruction the extraction follows; `enum` lists the allowed values. At most 10 fields per level and 3 levels.

```python
resp = client.extract_video_data(
    video_url=url,
    schema={
        "type": "object",
        "properties": {
            "product": {"type": "string", "description": "Product the video is about. Empty if none."},
            "verdict": {"type": "string", "enum": ["positive", "mixed", "negative"], "description": "The creator's overall opinion."},
            "claims": {"type": "array", "description": "Factual claims made about the product.",
                       "items": {"type": "string", "description": "One claim, as one short sentence"}},
        },
    },
)
```

- `evidence` gives, for each field that has a value, the moments it was taken from: `start` and `end` in seconds, and `in`: `speech` (said), `picture` (shown on screen, with `include_scenes`) or `post` (the post's own text, without times). Use it to link to the moment.
- With `include_scenes`, values can also come from what the video shows, and the result has `frames_analyzed`; `scenes_error` or `transcript_error` says when one of the two sources was missing. For the scenes themselves, with their times, use `watch`.
- An invalid schema is refused with `invalid_schema` before anything is billed; a request with neither `schema` nor `what_to_extract` with `missing_parameter`.

## Errors

Every SDK error extends `VidNavigatorError` and carries `status_code` and a machine-readable `error_code`: branch on the code, not on the message.

| Status | Class | Meaning |
|---|---|---|
| 400 | `BadRequestError` | Invalid parameters or schema |
| 401 | `AuthenticationError` | Missing, invalid or deactivated API key |
| 402 | `InsufficientCreditsError`, `StorageQuotaExceededError` (both a `PaymentRequiredError`) | Not enough credits (`insufficient_credits`), or the storage of the plan is full (`storage_quota_exceeded`) |
| 403 | `AccessDeniedError` | The content needs a login or an age check (`content_restricted`); the plan does not include the endpoint (`access_denied`) |
| 404 | `NotFoundError` | No transcript, no such video or file, unknown or expired `task_id` |
| 409 | `ScenesNotAvailableError` | `include_scenes` on an uploaded file whose scenes are not there yet: `scenes_status` says whether to start them or to wait |
| 429 | `RateLimitExceededError`; `TooManyActiveJobsError` | Too many requests; too many jobs running |
| 451 | `GeoRestrictedError` | Content not available in the region |
| 503 | `SystemOverloadError` | Temporary overload (`system_overload`, retry after `retry_after_seconds`), or the service briefly could not authenticate or bill the request (`service_unavailable`, nothing charged): retry |

Waiting for a job that outlasts its timeout raises `TaskTimeoutError`: the job keeps running and can be resumed with its `task_id`.

## Good practice

- Transcripts, extraction and tweet analysis read what is **said** in a video and its details. What it **shows** (the scenes and the text on screen) comes from `watch`, and extraction and tweet analysis read it too with `include_scenes` (SDKs 2.5.0 for extraction, 3.0.0 for tweets). Ask for it when the answer may be on screen: it adds a charge per frame analyzed, 1 credit per 2,000 frames with at least 667 frames per hour of video.
- On a post on X, `include_scenes` reads the post's video and the quoted post's video: the result's `data` then has `frames_analyzed`, and `scenes_error` when a video's picture could not be read (that video is then summarized from its transcript). If the frames cannot be paid for, the request answers `402`.
- Test with one short video before a batch, and bound every search with `max_results`.
- Pass `include_usage=True` to see what a call consumed; what each operation costs: https://docs.vidnavigator.com/api-reference/usage-costs.md
- Rate limits per endpoint: https://docs.vidnavigator.com/api-reference/rate-limiting.md. On `429`, wait and retry with backoff.
- TikTok search takes a `country` (default `gb`, `us` not available); TikTok LIVE search takes one too (default `us`).
- For an agent rather than code, the same operations are served as MCP tools at `https://api.vidnavigator.com/mcp/`: https://docs.vidnavigator.com/mcp-server.md
