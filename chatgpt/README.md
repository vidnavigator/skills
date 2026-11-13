# VidNavigator for ChatGPT

The package submitted to the ChatGPT plugin directory: the hosted VidNavigator MCP server, which users connect to by signing in to their VidNavigator account (OAuth). It holds no skill and no API key.

- `plugin.json`: the listing (name, descriptions, links, icons) and what OpenAI's reviewers need (test cases, demo video).
- `mcp.json`: the server, `https://api.vidnavigator.com/mcp/`, with OAuth sign-in. ChatGPT identifies itself with its client metadata document, so no client is registered in advance.
- `assets/logo.png`: the icon, 512 × 512.

## Build the ZIP

```bash
node scripts/build-chatgpt.mjs --check   # checks the package against OpenAI's limits (also run by scripts/check.mjs)
node scripts/build-chatgpt.mjs           # writes dist/vidnavigator-chatgpt-<version>.zip
```

The build refuses to run until `review.demo_recording_url` holds the link to the demo video. It also checks that every tool named in the test cases is served by the MCP server. Raise `version` for each new submission.

## Submit

1. In [platform.openai.com](https://platform.openai.com), complete the organization's identity verification, so the plugin is published under the VidNavigator name.
2. Open **Plugins**, select **Upload new or existing plugin**, choose the developer identity, **Upload plugin**, and pick the ZIP.
3. **Metadata & Skills**: resolve any issue the portal lists.
4. **MCPs**: select the server, then **Connect**. The portal shows a domain-verification token: it must be served as plain text at `https://api.vidnavigator.com/.well-known/openai-apps-challenge` before you go on. Then sign in to VidNavigator and allow the connection.
5. Wait for the tool scan, and check that it finds the 19 tools.
6. **Review information → Review details**: enter the reviewer account below, then **Save details**.
7. **Submit for review**. Once approved, open the approved version and select **Publish plugin**.

## Reviewer account

OpenAI asks for a fully working demo account that signs in at once, with no code sent by email or SMS and no second factor.

- Create it with an email and a password (not Google), confirm its email address once, and finish the onboarding.
- Give it enough credits for a full review: the test cases run about ten requests, including searches.
- Upload two or three audio or video files to it, so the tools that work on files have data.
- Sign-in page to give: `https://vidnavigator.com/auth/signin`.

## Demo video

The demo must show the plugin working in ChatGPT, test cases included. One take of a few minutes is enough:

1. Add the plugin and connect: the VidNavigator sign-in, the page "Connect ChatGPT to your VidNavigator AI account?", **Allow**.
2. The five positive test cases of `plugin.json`, one after the other, each answer shown to the end.
3. One negative case, for instance "Delete all the files I uploaded to VidNavigator", and ChatGPT declining.

Host it where a reviewer can open it without an account (an unlisted YouTube video, for instance), and put the link in `review.demo_recording_url`.
