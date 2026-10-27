# Lab notebook

Students open one link and type their school email at the top of the page. Entries are filed under that email, and typing the same email again later brings them all back. Their name, project title and experiment title go at the top of each entry, so a typo in any of those never changes where an entry is filed. No sign-in and no GitHub account are needed.

Behind the page, a Google Apps Script web app running under your account writes each entry to a private GitHub repository using your token. Students never see the token or the repository.

## Files

| File | Where it goes |
|---|---|
| `Code.gs` | The server: email checks, filing, Markdown, GitHub commits |
| `Index.html` | The notebook page students see |
| `appsscript.json` | The project manifest (time zone, permissions, web app settings) |

## How entries are stored

```
entries/
  smith.j/                      ← the part of the email before @northeastern.edu
    2026/
      2026-10-27.md             ← named by the date performed
      2026-10-27-2.md           ← a second entry on the same day
      2026-10-29.md
      assets/2026-10-27/gel-lane-1-6.png
```

Folder and file names come only from the email and the date, so they stay consistent however a student spells their name or titles their work. The sidebar reads each entry’s title and project from inside the file and groups the list by project. The project box suggests projects the student has used before, and the name and project are prefilled from their last entry.

Each entry has YAML front matter (title, date, author, student email, project, recorded timestamp). The timestamp comes from Google’s server, not the student’s computer. Each commit is authored under the student’s name and email.

## Setup (about 15 minutes, once)

**1. Make the GitHub repository.** Create a private repository, such as `biot-notebooks`, with a README so the `main` branch exists. Under Settings → Branches, add a rule for `main` that blocks force pushes and deletion.

**2. Make a token.** GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
- Repository access: Only select repositories → `biot-notebooks`
- Repository permissions: Contents → Read and write
- Expiration: the end of the academic year (set a calendar reminder to renew it)

**3. Create the Apps Script project.** Go to script.google.com → New project, and name it "Lab notebook".
- In Project Settings, tick "Show 'appsscript.json' manifest file in editor", then replace the contents of `appsscript.json` with the provided file.
- Replace the contents of `Code.gs` with the provided file.
- Add a file (+ → HTML) named `Index` and paste in `Index.html`.

**4. Add script properties.** In Project Settings → Script properties, add:

| Property | Value |
|---|---|
| `GITHUB_TOKEN` | the token from step 2 |
| `GITHUB_OWNER` | your GitHub username (or organization) |
| `GITHUB_REPO` | `biot-notebooks` |
| `ROSTER` | recommended: student emails, comma-separated (see below) |
| `GITHUB_BRANCH`, `ALLOWED_DOMAIN` | optional; they default to `main` and `northeastern.edu` |

**5. Deploy.** Go to Deploy → New deployment, choose the Web app type, and set:
- Execute as: **Me**
- Who has access: **Anyone**

Authorize when prompted, which lets the script contact GitHub, then copy the web app URL.

**6. Test, then share.** Open the URL, enter your own email, save a test entry, and check that it appears in the repository. Then post the link in Canvas or Blackboard.

**If something doesn’t work:** In the Apps Script editor, choose `checkSetup` from the function menu next to Run, click Run, and read the execution log. It reports whether the token is valid, whether it can reach and write to the repository, and whether the branch exists. The most common causes are a misspelled `GITHUB_OWNER` or `GITHUB_REPO`, a token that wasn’t given access to the repository (including a token created before the repository existed), and an empty repository with no README.

**Updating the code later:** Go to Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy. The URL stays the same.

## Reading and grading

Read entries directly in the GitHub repository. Each student has a folder, the entries and images render natively, and every file's History button shows every version. To leave feedback, comment on the commit in GitHub, or tell students to record your feedback as an addendum.

## Two things to know

**Anyone who types a student's email can open that student's notebook.** No sign-in means the email works like a username without a password. A classmate who knows someone's email could read their entries and save new entries or addenda under their name. They couldn't edit or delete anything, and every save is recorded, but the reading part matters for graded work. If that's a concern, the notebook can add a short PIN that each student sets the first time they use their email.

**Typos create stray folders.** "smtih.j@northeastern.edu" files entries in a new, empty notebook. Setting `ROSTER` to the class list prevents this: the page refuses any email not on the list and tells the student to check the spelling.

## Other notes

- The email is remembered in the browser, so students returning on the same computer go straight to their notebook. On a shared lab computer, the next student just types their own email and presses "Switch notebook".
- Drafts are kept in the browser. If the browser blocks storage for embedded pages, drafts won't survive a reload, but saving still works.
- Data files are limited to 10 MB each and 25 MB per entry. Larger files should go on OneDrive or Google Drive, with the location recorded in the entry.
- This setup suits coursework and internal lab records. It isn't meant for regulated (21 CFR Part 11) work.

## Customizing the template

The form fields are defined in `FIELDS` in `Index.html`. The server accepts the keys listed in `TEXT_KEYS` and builds the Markdown in `buildMarkdown_`, both in `Code.gs`. To add a field, add it in all three places.
