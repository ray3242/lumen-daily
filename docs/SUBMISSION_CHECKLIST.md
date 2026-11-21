# Submission checklist

Work through these steps in order. Replace every angle-bracket placeholder before submitting. You do not need to buy hosting, a domain, assets, or developer tools.

## 1. Create the accounts

1. If you do not already have a Reddit account, create one at https://www.reddit.com/register/. Verify your email and keep the login available. Use this same account for the developer portal, CLI login and test community.
2. Visit https://developers.reddit.com/, sign in with that Reddit account, and accept the Developer Terms when prompted. Complete any account setup the portal requests.
3. Create a free account at https://devpost.com/users/register, open the **Reddit Game of the Day** hackathon page from the organizer's invitation, and select **Join hackathon**. Read its current eligibility rules, deadline, required submission fields and video requirements. Joining is not the same as submitting a project.

## 2. Create a public test community

4. While signed in to Reddit, visit https://www.reddit.com/subreddits/create. Create a small community you moderate and set its community type to **Public**, not Private or Restricted. Keep it below **200 members**; the CLI restricts unreviewed app installations to small test communities. If Reddit imposes a new-account creation restriction, complete Reddit's requirements before proceeding.
5. Save its full URL as `<SUBREDDIT_URL>`, for example `https://www.reddit.com/r/YOUR_TEST_SUBREDDIT/`. In terminal commands below, replace `YOUR_TEST_SUBREDDIT` with only the community name, without angle brackets.

## 3. Prepare and upload the app

6. Install Git and Node.js **22.12 or newer** (Node 22 LTS is recommended). Open a terminal. If this project is not already on your computer, run:

   ```sh
   git clone https://github.com/ray3242/lumen-daily.git
   cd lumen-daily
   git switch devin/lumen-game
   ```

   If the pull request has already been merged, use `git switch main` instead. Run all remaining commands from this folder, where `package.json` and `devvit.json` live. If using nvm, run `nvm install && nvm use` first.

7. Install the locked dependencies, authenticate in the browser and upload:

   ```sh
   npm ci && npx devvit login && npx devvit upload
   ```

   Sign in with the account from step 1 and approve the requested access. Follow any app-registration prompts. If this manually configured project has not yet been associated with a developer app, use `npx devvit init` and follow the portal's initialization-code instructions, keeping the existing game files. Do not use `--force` or replace the game with a new template. Then repeat `npx devvit upload`.

   The configured name is `lumen-daily`. If Reddit reports that it belongs to another developer, choose an available lowercase name of at most 16 characters, change `name` in `devvit.json`, complete registration, and update the app-listing link in `docs/DEVPOST.md`. A GitHub repository name does not reserve a Reddit app name.

8. Check the build and rules before sharing the demo:

   ```sh
   npm run type-check
   npm run lint
   npm test
   npm run build
   npm run validate:config
   ```

   `npm run deploy` is also available: it builds, type-checks and runs `devvit upload`. The explicit `upload` command above uses the build script configured in `devvit.json`.

## 4. Install and make a playable post

9. Install the uploaded app into your public test community:

   ```sh
   npx devvit install YOUR_TEST_SUBREDDIT
   npx devvit list installs YOUR_TEST_SUBREDDIT
   ```

   The first command defaults to this project's latest uploaded version. Approve any permissions prompts. The second command should show Lumen installed.

10. Open the community on Reddit while signed in as its moderator. Installation should create the first Lumen post. Open the community's overflow/moderator menu and select **Create today's Lumen post** if needed. This reuses today's existing post rather than making another one. Open the resulting interactive post, copy its full Reddit URL, and save it as `<DEMO_POST_URL>`.
11. Play the post: select **Play today’s puzzle**, tap mirrors until every crystal is lit, and select **Save your result**. Check the timer, par, rank and streak. Test **Share as a comment**, subscription and flair separately only if you want those actions performed. Sharing should reply in the pinned score thread. Unapproved apps can attribute user actions to the app account for players other than the owner; community permissions can also prevent flair changes. Confirm the public post opens in a signed-out browser, then sign in to check saving. Keep the post and community public through judging.
12. For live iteration, run:

    ```sh
    npx devvit playtest YOUR_TEST_SUBREDDIT
    ```

    This installs the app, watches changes and streams logs. Stop with Ctrl+C when finished; the last installed version remains on Reddit. This is different from `npm run dev:local`, which never contacts Reddit. After changes, upload/install the final version again and re-check the saved demo URL.

## 5. Prepare the video and project page

13. Review `docs/DEMO_SCRIPT.md`. The supplied `demo-portrait.mp4` and `demo-landscape.mp4` files in the sibling `lumen-shots` folder are real local-harness recordings, not footage of Reddit actions. If using them, describe the video as a gameplay preview; do not imply its local Share preview posted a Reddit comment. You can replace or supplement them with a recording of the public Reddit demo post. Keep the final video under **60 seconds**.
14. Sign in at https://studio.youtube.com/ and choose **Create → Upload videos**. Upload the MP4. Set visibility to **Public**, or **Unlisted** if the hackathon allows a publicly accessible unlisted link. Never choose Private or members-only. Wait for processing, open the watch URL in a signed-out browser, confirm playback without permission, and save it as `<YOUTUBE_URL>`.
15. Edit the top links and judge instructions in `docs/DEVPOST.md`: fill `<DEMO_POST_URL>`, `<SUBREDDIT_URL>` and `<YOUTUBE_URL>`, and confirm the app-listing URL matches the registered app name. Search for `<` to catch remaining placeholders. Verify every link in a signed-out browser. An uploaded app listing may remain visible only to its owner; the public Reddit demo post is the primary play link.

## 6. Submit

16. Return to the hackathon's Devpost page and select **Create project** or **Submit project**. Copy the sections from `docs/DEVPOST.md` into the matching fields. Add the repository URL, app listing, playable demo URL, public test subreddit URL, YouTube link, screenshots, team details and Built with tags. Answer all organizer-specific eligibility and disclosure fields truthfully. Do not mark an untested Reddit integration as tested.
17. Review the preview and submit before the organizer's deadline. Confirm the project appears in your Devpost dashboard as **submitted** to the correct hackathon, not just saved as a draft. Keep a copy of the final submission URL.
18. If the organizers provide a feedback survey, complete it using their official survey link. This is optional unless the hackathon rules say otherwise.

### Upload, playtest and publish are different

These commands were checked against the installed **Devvit CLI 0.15.4** help and the official [CLI](https://developers.reddit.com/docs/guides/tools/devvit_cli) / [playtest](https://developers.reddit.com/docs/guides/tools/playtest) documentation:

- `devvit upload`: uploads an owner-visible version for small-community testing; it does **not** request public app approval.
- `devvit install SUBREDDIT`: installs an uploaded app into a community you moderate.
- `devvit playtest SUBREDDIT`: installs, watches local changes and streams logs.
- `devvit publish`: creates/uploads a version and submits it for review (unlisted review by default); `devvit publish --public` requests public listing review. This is not a substitute for installation, and review is not instant. Only run it when the hackathon or your intended launch requires review; allow time for Reddit approval, especially for user actions.

You must perform the Reddit, YouTube and Devpost account actions yourself. No account credentials belong in this repository.
