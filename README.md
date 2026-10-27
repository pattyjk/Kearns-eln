# Lab notebook (school-account version)

Students open one link, sign in with their UMass Boston account, and fill in the notebook form. They never need a GitHub account. A Google Apps Script web app, running under your account, checks who each student is and commits their entries to a private GitHub repository using your token, which students never see.

```
student’s browser  ──(UMB Google sign-in)──▶  Apps Script web app  ──(your token)──▶  private GitHub repo
```

## Files

| File | Where it goes |
|---|---|
| `Code.gs` | The server: identity checks, access rules, Markdown, GitHub commits |
| `Index.html` | The notebook page students see |
| `appsscript.json` | The project manifest (time zone, permissions, web app settings) |

## How entries are stored

```
entries/
  jsmith/                 ← the part of the student’s email before @umb.edu
    2026/
      2026-10-27-pcr-optimization.md
      assets/2026-10-27-pcr-optimization/gel-lane-1-6.png
```

Each entry has YAML front matter (title, date, author, student email, course, recorded timestamp). The timestamp comes from Google’s server, not the student’s computer.

## Setup (about 20 minutes, once)

**1. Make the GitHub repository.** Create a private repository, for example `biot-notebooks`, with a README so the `main` branch exists. Under Settings → Branches, add a rule for `main` that blocks force pushes and deletion.

**2. Make a token.** GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
- Repository access: Only select repositories → `biot-notebooks`
- Repository permissions: Contents → Read and write
- Expiration: the end of the academic year (put a reminder in your calendar to renew it)

**3. Create the Apps Script project.** Sign in to Google with your UMass Boston account and go to script.google.com → New project. Name it “Lab notebook”.
- In Project Settings, tick “Show ‘appsscript.json’ manifest file in editor”, then replace the contents of `appsscript.json` with the provided file.
- Replace the contents of `Code.gs` with the provided file.
- Add a file (+ → HTML) named `Index` and paste in `Index.html`.

**4. Add script properties.** Project Settings → Script properties:

| Property | Value |
|---|---|
| `GITHUB_TOKEN` | the token from step 2 |
| `GITHUB_OWNER` | your GitHub username (or organization) |
| `GITHUB_REPO` | `biot-notebooks` |
| `INSTRUCTORS` | your email, plus any TAs, comma-separated |
| `ROSTER` | optional: student emails, comma-separated. Leave it out to allow anyone with a UMB account. |
| `GITHUB_BRANCH`, `ALLOWED_DOMAIN` | optional: default to `main` and `umb.edu` |

**5. Deploy.** Deploy → New deployment → type: Web app.
- Execute as: **Me**
- Who has access: **Anyone within UMass Boston**

Authorize when prompted (this lets the script contact GitHub and read the signed-in user’s email). Copy the web app URL.

**6. Test, then share.** Open the URL yourself: you should see “(instructor)” next to your email. Save a test entry and check it appears in the GitHub repository. Then post the link in Canvas or Blackboard.

**Updating the code later:** Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy. The URL stays the same.

## What students and instructors can do

Students see and open only their own entries; the server enforces this, not the page. They can add dated, signed addenda to their own entries but can’t edit or delete anything, and have no access to the repository or its history.

Instructors (anyone in `INSTRUCTORS`) get a “Showing” menu to view every student or one student at a time, a link to each entry’s history on GitHub, and can add an “Instructor note” to any entry, which the student sees the next time they open it. You can also read everything directly in the GitHub repository, where entries and images render natively.

In the Git history, each commit is authored by the student’s name and UMB email and committed through your token, so authorship and timing are traceable for every change.

## Things to know

- **Sign-in confusion:** Students signed in to a personal Gmail account may be shown as the wrong account. The page tells them which account it sees and asks them to switch. A separate browser profile for their UMB account avoids this, as UMB IT also recommends.
- **IT restrictions:** If UMB’s Google Workspace administrators have restricted Apps Script web apps or outside connections, step 5 or the first save may fail with a permissions message. That would need a request to the IT Service Desk.
- **Drafts:** Drafts are kept in the student’s browser. If the browser blocks storage for embedded pages, drafts won’t persist across reloads, though saving still works.
- **File sizes:** Data files are limited to 10 MB each and 25 MB per entry. Larger files should be stored on OneDrive or Google Drive, with the location recorded in the entry.
- **Names:** Each student’s name is saved once and kept in the script properties, so it follows them across devices.
- **Regulated work:** This is suited to coursework and internal lab records, not regulated (21 CFR Part 11) work.

## Customizing the template

The form fields are defined in `FIELDS` in `Index.html`. The server accepts the keys listed in `TEXT_KEYS` and builds the Markdown in `buildMarkdown_` in `Code.gs`. To add a field, such as “Safety considerations”, add it in all three places.
