# WhatsApp Clone

A full-stack real-time messaging app built with React, Express, MongoDB and Socket.IO.
Phone-number authentication, one-to-one and group chats, media sharing, voice notes,
status updates, and live delivery with typing indicators and read receipts.

<!-- Add screenshots here. Two or three is plenty: the chat view, a group, and dark mode. -->

## Features

**Messaging**
- One-to-one and group chats
- Text, images, video, documents, and recorded voice notes
- Replies, forwarding, editing (15-minute window), and reactions
- Delete for me and delete for everyone
- Read receipts with per-recipient message info
- Search across all conversations, jumping straight to the matching message
- Starred messages, chat export to `.txt`

**Chats**
- Pin, favourite, mute, archive, clear, delete
- Disappearing messages (24 hours, 7 days, or 90 days)
- Per-chat wallpaper

**Groups**
- Create with a contact picker, add and remove members
- Rename, group photo, promote admins, leave, delete
- Admin-only controls enforced server-side

**Realtime**
- Instant delivery, typing indicators, online/last-seen presence
- Live read receipts and reaction updates
- Desktop notifications with an unread badge in the tab title

**Other**
- Phone + OTP authentication (no passwords)
- Status updates that expire after 24 hours, with view tracking
- Link previews with Open Graph data
- Light and dark themes
- Blocking, in both directions

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router |
| Backend | Node.js, Express 5 |
| Database | MongoDB with Mongoose |
| Realtime | Socket.IO |
| Auth | JWT, OTP over SMS (Twilio) |
| Uploads | Multer, served from local disk |

## Quick start

**Prerequisites:** Node.js 18+, MongoDB running locally (or a MongoDB Atlas connection string).

```bash
git clone https://github.com/<your-username>/whatsapp-clone.git
cd whatsapp-clone
```

**Server**

```bash
cd server
npm install
cp .env.example .env      # then fill in the values
npm run dev
```

**Client** — in a second terminal:

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173.

**Signing in:** there is no signup. Enter any phone number in international format
(`+923001234567`) and the account is created on first verification. With
`OTP_MODE=console` the code is printed in the server terminal and shown in the browser,
so no SMS is needed during development.

To see realtime features work, open a second account in an incognito window.

## Configuration

`server/.env`:

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Any long random string. Changing it invalidates all sessions |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `30d` |
| `CLIENT_URL` | Must match the Vite dev server exactly, or CORS blocks every request |
| `OTP_MODE` | `console` prints codes to the terminal, `sms` sends via Twilio |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | Only needed for `OTP_MODE=sms` |

`client/.env`:

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend origin, e.g. `http://localhost:5000` |

Switching to real SMS also needs `npm install twilio` in `server/` — the SDK is imported
lazily so console mode works without it.

## Project structure

```
server/src
├── config/db.js            MongoDB connection
├── models/                 User, Chat, Message, Status
├── controllers/            Request handlers
├── routes/                 Express routers
├── middleware/             JWT auth, uploads, rate limiting
├── socket/                 Socket.IO setup and handlers
└── utils/                  OTP generation and delivery, link previews

client/src
├── context/                Auth, Socket, Chat, Message, Status, Theme
├── components/             UI components
├── lib/                    API client, helpers, emoji data
└── pages/                  Login, Home
```

## API

All routes except `/api/health` and the two auth endpoints require
`Authorization: Bearer <token>`.

**Auth** — `POST /api/auth/request-otp`, `POST /api/auth/verify-otp`, `GET /api/auth/me`

**Users** — `PATCH /api/users/me`, `GET /api/users/search?phone=`, `GET /api/users/:id`,
`POST /api/users/:id/block`, `POST /api/users/:id/unblock`, `GET /api/users/blocked`

**Chats** — `POST /api/chats` (open or create a direct chat), `GET /api/chats`,
`GET /api/chats/:id`, `POST /api/chats/group`, `PATCH /api/chats/:id/read`,
`PATCH /api/chats/:id/{pin,favourite,mute,archive,disappearing}`,
`PATCH /api/chats/:id/group`, `POST /api/chats/:id/participants`,
`DELETE /api/chats/:id/participants/:userId`, `POST /api/chats/:id/admins/:userId`,
`DELETE /api/chats/:id`, `DELETE /api/chats/:id/messages`, `DELETE /api/chats/:id/group`

**Messages** — `POST /api/messages`, `GET /api/messages/:chatId`,
`GET /api/messages/:chatId/around/:messageId`, `PATCH /api/messages/:chatId/read`,
`PATCH /api/messages/:id`, `DELETE /api/messages/:id?scope=me|everyone`,
`POST /api/messages/:id/star`, `POST /api/messages/:id/react`,
`GET /api/messages/:id/info`, `GET /api/messages/starred/all`,
`GET /api/messages/search/all?q=`

**Status** — `POST /api/status`, `GET /api/status`, `POST /api/status/:id/view`,
`GET /api/status/:id/viewers`, `DELETE /api/status/:id`

**Uploads** — `POST /api/uploads/avatar`, `POST /api/uploads/media` (multipart, field `file`)

### Socket events

The client authenticates on connect with `io(url, { auth: { token } })`.

Server emits: `message:new`, `message:edited`, `message:deleted`, `message:status`,
`message:reaction`, `message:preview`, `messages:read`, `chat:updated`,
`chat:disappearing`, `group:updated`, `group:removed`, `group:deleted`,
`presence:update`, `typing:start`, `typing:stop`

Client emits: `chat:join`, `chat:leave`, `typing:start`, `typing:stop`,
`message:delivered`, `message:read`

## Design notes

**Soft deletion throughout.** Deleting a message or a chat marks it for one user rather
than removing rows, which is what lets "delete for me" and "delete for everyone" coexist.
The only destructive operation is an admin deleting a group.

**Per-user flags are arrays, not booleans.** Pinning, muting, starring and unread counts
all differ per participant on the same shared document, so they're stored as arrays of
user ids (or a Map for counts) and flattened per requester in the response.

**Expiry is delegated to MongoDB.** Status updates and disappearing messages carry an
`expiresAt` and rely on a TTL index, so nothing needs a scheduled cleanup job.

**Cursor pagination, not skip/limit.** Paginating message history on a timestamp cursor
avoids the duplicate and skipped rows that `skip` produces when new messages arrive
mid-scroll.

**Link previews are fetched after the response.** A slow site never delays a send; the
preview arrives separately over the socket. The URL is DNS-resolved and checked against
private address ranges before any request is made, which blocks the SSRF path to cloud
metadata endpoints and internal services.

## Known limitations

- **Uploads are stored on local disk**, so they won't survive a deploy to a platform with
  an ephemeral filesystem. Moving to S3 or Cloudinary is required before hosting.
- **No voice or video calling** — that needs WebRTC and is out of scope here.
- **Contacts are inferred from existing chats**, since there is no address book to read.
- **File type checking trusts the mimetype and extension.** Verifying magic bytes would be
  the next step for anything public-facing.

## About this project

Built for learning and practice. It is not affiliated with, endorsed by, or connected to
WhatsApp or Meta in any way — the name and interface are referenced only as a familiar
target to build against.

No license is attached, so the code is not offered for reuse. If you'd like to use any of
it, get in touch.
