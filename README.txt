ISLA DRIVE — PRIVATE MULTIPLAYER
Two islands. Four friends. Shared chaos.

READY TO UPLOAD
This folder is the complete multiplayer project. It has been tested locally;
it is not published until you complete the GitHub and Render steps below.
Your separate ISLA-Drive.html download continues to work as a solo game.

1. UPLOAD TO GITHUB
Open https://github.com/new and sign in as cadocodes-art.
Name the repository isla-drive. Choose Private. Create the repository.
On the empty repository page, choose “uploading an existing file”.

Extract ISLA-Drive-Multiplayer.zip first. Open the extracted folder containing
package.json and server.cjs. Select EVERYTHING INSIDE that folder and drag
it onto GitHub's upload page, including the public, scripts, and test folders.
Upload the extracted contents, not the ZIP or its outer enclosing folder.
Commit the files to main with the message “Add ISLA private multiplayer”.

Check the repository's top level: package.json, package-lock.json, server.cjs,
server-world.cjs, render.yaml, and the public folder should be visible there.
The project is fewer than 100 files, and no file exceeds GitHub's upload limit.

2. DEPLOY ON RENDER
Open https://dashboard.render.com and sign in.
Choose New > Web Service. Connect GitHub and select cadocodes-art/isla-drive.
If Render asks which repositories it can access, select only isla-drive.

Use these settings:
  Name:              isla-drive (or another available name)
  Language/runtime:  Node
  Branch:            main
  Root Directory:    leave blank
  Build Command:     npm ci
  Start Command:     npm start
  Instance Type:     Free
  Health Check Path: /healthz (under Advanced, if shown)

The package requests Node 24.x. No database, API keys, or extra environment
variables are needed. Keep this as a single instance; rooms live in memory.
Choose Deploy Web Service. Wait for Live, then open the HTTPS onrender.com
address Render gives you. This is a Web Service because multiplayer needs
the running room server. A static-site upload alone cannot host the rooms.

Alternative: the included render.yaml can create the same Free web service
through Render's New > Blueprint flow after you connect the repository.

3. PLAY WITH FRIENDS
Open the Render address. Choose PLAY WITH FRIENDS, enter a driver name,
and create a room. The game starts immediately, so you can drive while waiting.
Click the room code at the top right to see the lobby and COPY INVITE.
Friends open that link, enter their own names, and choose JOIN ROOM.
They can also open your game address and enter the six-character code.
Each room holds up to four people. Anyone with its code can join that room.

WHAT IS SHARED
You see other players' selected cars, steering, jumps, water skims, and nitro
flames. Traffic and building damage are shared within each room. Each room
has its own session-aura leaderboard. The host can rebuild both islands from
the pause menu. Rebuilding keeps room scores and personal garage progress.

Players' cars are ghosted: they pass through each other. Traffic and buildings
still have collisions. This avoids lag knocking friends off a stunt.
Pausing or opening a menu parks your car while the room keeps running.
Brief disconnects reserve your spot for 90 seconds and reconnect automatically.
The host role passes to a connected friend if the host disconnects or leaves.

SAVES AND FIRST-RELEASE LIMITS
Personal aura and unlocked cars save in each browser for that game address.
They are not cloud accounts. Your file-based solo save stays untouched and
does not automatically transfer to the new Render address. Another browser,
device, or website address has its own save.

Rooms, their destruction, and session scores are temporary. A server restart
or redeploy clears them; create a new code afterward. Personal browser saves
survive server restarts. Empty rooms expire after about ten minutes.

Render's Free service sleeps after 15 minutes without traffic and may take
about a minute to wake. Its free usage limits still apply. Free hosting is
appropriate for trying this with friends; this is not a capacity guarantee.

This version is for private friend sessions, not ranked competition. The
server owns room membership, building integrity, traffic, and the scoreboard;
it validates message sizes, ranges, rates, and nearby impacts. Driving and
stunt detection remain client-side, so a modified client can cheat. Before a
global competitive room or shared economy, add authoritative simulation,
accounts, persistent storage, and broader load/security testing.

RUN LOCALLY (OPTIONAL)
Install Node.js 24 from https://nodejs.org. Open a terminal in this folder:
  npm ci
  npm test
  npm start
Then open http://localhost:3000 in two tabs to try a room.
To rebuild a standalone solo HTML file after edits: npm run build:offline
The resulting file is written to dist/ISLA-Drive.html.

PROJECT MAP
  public/          Game, UI, world, physics, garage, and multiplayer client
  server.cjs       Static hosting, rooms, WebSockets, validation, traffic
  server-world.cjs Shared terrain/building model for the server
  test/            Networking and original-game regression checks
  scripts/         Standalone packaging helper
  render.yaml      Free Render deployment configuration

Three.js is vendored under its included MIT license in public/THREE-LICENSE.txt.
The server's ws dependency is pinned by package-lock.json (MIT licensed).

OFFICIAL SETUP REFERENCES
GitHub file/folder uploads:
https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
Render Node services: https://render.com/docs/deploy-node-express-app
Render WebSockets: https://render.com/docs/websocket
Render free-service limits: https://render.com/docs/free
