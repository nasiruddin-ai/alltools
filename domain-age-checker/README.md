# Domain Age Checker

A small tool that tells you when a domain was first registered and how old it is.
No programming knowledge is needed to run it.

## How to run it

1. Open this folder.
2. Double-click **Start.bat**.
3. A black window opens and your browser opens to `http://localhost:3000`.
4. Type a domain (for example `google.com`) and press **Check age**.

To stop the tool, close the black window.

## What is in this folder

| File | What it does |
|---|---|
| `index.html` | The page you see in the browser. Change text, colours, or layout here. |
| `server.js` | The small program that asks the internet for the domain's registration date. |
| `Start.bat` | Starts the tool. Double-click it. |
| `README.md` | This file. |

## Where the data comes from

The tool uses RDAP, the public registry lookup system that replaced WHOIS.
It is free, needs no account or API key, and returns the registration date,
expiry date, registrar, and status directly from the registry.

A few country-code registries (for example `.de`) do not publish registration
dates. The tool will say "Age unavailable" for those. Common endings like
`.com`, `.org`, `.in`, and `.co.uk` all work.

## Putting it on a website later

The page needs `server.js` running somewhere, because browsers are not allowed
to call RDAP directly. Any host that runs Node.js will work (Render, Railway,
Fly.io, a VPS). Upload the folder, run `node server.js`, and point your domain
at it. Or embed just the lookup logic in an n8n webhook and let `index.html`
call that instead of `/api/age`.
