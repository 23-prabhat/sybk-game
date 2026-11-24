# SYBK · Show Your Ball Knowledge

**Let’s test your elite ball knowledge.**

SYBK is a Devvit Web game hosted by Pip, a pigeon with a microphone and strong opinions. Play from a Reddit Interactive Post.

## Play

- **Daily Solo** serves the same five authored clues to everyone on a given UTC date. Name a black silhouette or take on a caption, audio, or tile clue. You get one guess per question. Ask Pip for a free hint and keep the question worth 100, or trade 30 points from that question’s reward for a stronger clue and play for 70. The original art appears in the reveal. Pip introduces the board on the first visit and coaches tile play, misses, and streaks. Signed-in players can resume, see their daily and weekly rankings, and vote for the weekend’s theme.
- **Live Duels** supports matchmaking and friend rooms. Create a room, share its Reddit link or room code, and press **Ready** once both players join. The first accepted buzz opens a 12-second type-in window or a seven-second choice window. Pip gives both players a free clue after eight seconds. Only the player with the floor can trade 30 points of their reward for a private clue. A miss passes the opportunity to the other player. Players can rejoin and request a rematch.
- **After Dark** is an optional Solo and live pack with uncensored profanity, adult jokes, and satire. The server requires an explicit confirmation and Reddit’s over-18/NSFW viewing flag. Regular posts and leaderboards use the broad-audience pack.

## Local preview

Use Node 24.18 or later.

```bash
npm ci
npm run check
npm run preview
```

Open `http://127.0.0.1:4185/splash.html`. To play both seats, open the preview in two tabs and pass a different `?player=` value in each URL. Try `?player=PipFan` and `?player=ClipGoblin`. `?player=NoAdults` exercises the adult-content denial. Local identity, score storage, invite lookup, and room updates are simulated. The preview uses in-memory storage and HTTP polling.

## Reddit playtest

1. Sign in with `npx devvit login` and use a Devvit app name you own in `devvit.json`.
2. Run `npm run build` and `npx devvit upload`, then `npx devvit playtest <test-subreddit>`.
3. Choose **Create or open the SYBK hub** from the subreddit moderator menu. The hub opens the current daily drop. Use **Create the SYBK daily post** for a dated post that becomes an archive after midnight UTC. Scheduled posts appear at 00:01 UTC and use the winning weekend theme when a vote is present.
4. Open the post from separate Reddit accounts. Verify an in-game invite and a shared Reddit challenge, then join, buzz, lose the floor, steal, disconnect, rejoin and finish. Confirm the Reddit age/NSFW setting gates After Dark. These flows use the real Redis and Realtime services only in Devvit.

See the [hackathon entry](SUBMISSION.md) for the app listing, test subreddit, and demo post.

## Data and art

Ranked results tie a Reddit account ID to points and show the Reddit username. The game stores round progress to resume it and room membership to authorize multiplayer actions. Solo history and rankings expire after 90 days, rooms after one day, and unopened invitations after 15 minutes. Reports are available from the moderator menu and expire after 14 days. The app uses Reddit-hosted services and static game assets.

Pip and the original illustrated clues were generated with ImageGen. The game bundles WebP illustrations, an animated clue, and font licenses under `src/client/public/`. Use **Report clue** for content issues and contact the demo subreddit’s moderators for support or data requests.

### Photo meme credits

The photos are bundled as WebP. The clue reveal identifies the source and links the license where required.

| Clue | Credit and reuse |
| --- | --- |
| Honest Work | Dianne Johnson / USDA. U.S. public domain. [Source photo](https://commons.wikimedia.org/wiki/File:Ohio_farmer_David_Brandt.jpg) |
| Not Impressed | Pete Souza / Official White House Photo. U.S. public domain. [Source photo](https://commons.wikimedia.org/wiki/File:Barack_Obama_with_artistic_gymnastic_McKayla_Maroney_2.jpg) |
| I Can Has Cheezburger? | Or Hiltch, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). Caption cropped for the clue. [Source image](https://commons.wikimedia.org/wiki/File:I_can_has_cheezburger.jpg) |
| It’s Joever | LBJ Library. U.S. public domain. Caption cropped for the clue. [Source image](https://commons.wikimedia.org/wiki/File:Joever_meme.jpg) |
| Morgan Freeman “True” | Ed Campion / NASA Goddard Space Flight Center, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/). Commons alteration by Star Manatee. Caption cropped for the clue. [Source image](https://commons.wikimedia.org/wiki/File:Morgan_Freeman_%22true%22_meme.jpg) |
| Tung Tung Tung Sahur | noxaasht. AI-generated original listed as public domain where applicable on Commons. Silhouette adapted. [Source image](https://commons.wikimedia.org/wiki/File:Full_image_of_Tung_Tung_Tung_Sahur.png) |
| Ever Given | NASA JSC ISS image library. U.S. public domain. Cropped and silhouette adapted. [Source photo](https://commons.wikimedia.org/wiki/File:Ever_Given_in_Suez_Canal_viewed_from_ISS.jpg) |
| Numa Numa | Andrew Baron, [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/). Silhouette adapted from a photo of Gary Brolsma. [Source photo](https://commons.wikimedia.org/wiki/File:Gary_Brolsma.jpg) |
| Tralalero Tralala, Brr Brr Patapim, Bombardiro Crocodilo | AI-generated meme art compiled by DevonRex368, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Color crops and silhouetted adaptations are shared under the same license. [Source compilation](https://commons.wikimedia.org/wiki/File:Italian_brainrot_characters.png) |
