# ink

A fast, minimal webmail client for [JMAP](https://jmap.io) servers. Built for [Stalwart](https://stalw.art), works with any server that speaks JMAP Mail and Submission.

- Realtime: new mail and state changes arrive over JMAP push (EventSource), no polling
- Threads, search, archive, delete, reply, reply all, attachments
- HTML mail is sanitized with DOMPurify and rendered in a sandboxed frame with scripts disabled
- Keyboard first: `j` `k` move, `r` reply, `c` compose, `e` archive, `#` delete, `/` search, `Esc` close, `Cmd+Enter` send
- Pure static frontend. No backend of its own, no tracking, no accounts beyond your mail server

## How it works

ink is a single page app that talks to your mail server's JMAP API from the browser. It expects to be served from the same origin as the JMAP endpoints, so put it behind the same reverse proxy:

```caddy
mail.example.com {
	handle /jmap* {
		reverse_proxy 127.0.0.1:8080
	}
	handle /.well-known/jmap {
		reverse_proxy 127.0.0.1:8080
	}
	handle {
		root * /srv/ink
		try_files {path} /index.html
		file_server
	}
}
```

Credentials are sent with HTTP Basic auth to your own server only.

## Develop

```sh
npm install
JMAP_TARGET=https://mail.example.com npm run dev
```

The dev server proxies `/jmap` to `JMAP_TARGET`.

```sh
npm test        # unit tests
npm run build   # static build in dist/
```

`scripts/seed.ts` fills a test mailbox with sample mail and `scripts/smoke.ts` runs an end to end check against a live server. Both read `INK_USER` / `INK_PASSWORD` style settings described at the top of each file. Never point them at a real mailbox.

## Stack

React, TypeScript, Vite, Tailwind CSS, Motion.

## License

MIT
