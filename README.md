# Lab notebook

A form-based electronic lab notebook that saves each entry as a Markdown file in a GitHub repository. Students fill in structured fields (hypothesis, prediction, materials, procedure, results, interpretation), attach data files, and click save. The app writes the Markdown and commits it, so every entry is timestamped, signed, and versioned by Git.

The whole app is one file, `index.html`. It has no server and stores no data of its own: it talks directly to the GitHub API from the student’s browser.

## How entries are stored

```
entries/
  jsmith-umb/                      ← one folder per student (their GitHub username)
    2026/
      2026-10-27-pcr-optimization.md
      assets/
        2026-10-27-pcr-optimization/
          gel-lane-1-6.png
          plate-reader.csv
  apatel22/
    2026/
      ...
```

The folder name is the student’s GitHub username, read from their token when they connect, so it’s unique and students can’t mistype it. If the username can’t be read, the folder is named from “Your name” instead.

When a repository holds more than one student’s folder, a “Showing” menu appears above the entries list: “My entries” by default, any other student’s folder, or everyone at once (with each entry labeled by folder). Entries saved before folders were added stay where they are and appear under “Not in a student folder”.

Each entry has YAML front matter (title, date, author, student username, course, recorded timestamp), so the folder can later be rendered with Jekyll or Quarto without changes. GitHub also renders the entries and their images directly in the repository, which is the easiest place to read and grade them.

Saved entries are never rewritten by the app. Corrections are appended as dated, signed addenda, and the full version history is one click away.

## Instructor setup (once per course)

1. **Create a template repository.** Make a new private repository (e.g. `biot7245-notebook-template`) with a README and an empty `entries/` folder (add an `entries/.gitkeep` file). Under Settings, tick “Template repository”.
2. **Host the app.** Put `index.html` in a *public* repository that contains nothing else, such as `eln-app`, and turn on GitHub Pages for it (Settings → Pages → deploy from the main branch). The app is then at `https://<your-account>.github.io/eln-app/`.
   Don’t put the app inside students’ notebook repositories: GitHub Pages would publish their entries publicly.
3. **Create the GitHub Classroom assignment** from the template repository, with private student repositories. Each student who accepts gets their own notebook repository in the classroom organization.
4. **Allow fine-grained tokens for the classroom organization.** In the organization’s Settings → Personal access tokens, allow fine-grained tokens. If you leave approval required, you’ll approve each student’s token request once at the start of term.
5. **Share a prefilled link.** Adding `?owner=<classroom-org>` to the app URL fills that field in for students, e.g.
   `https://<your-account>.github.io/eln-app/?owner=umb-biot7245`. You can also add `&repo=` and `&branch=`.

## Student setup (once per term)

1. Accept the GitHub Classroom invitation. Note your repository name.
2. Create a token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
   - **Resource owner:** the classroom organization
   - **Expiration:** the end of the semester
   - **Repository access:** Only select repositories → your notebook repository
   - **Repository permissions:** Contents → Read and write
3. Open the app link, fill in the connection panel (organization, repository, branch `main`, your name, token) and click Connect.

On a shared lab computer, click “Forget token” before leaving.

## What students see

- A notebook page with the six sections in order; the hypothesis, procedure and observations are required before an entry can be saved.
- A Preview tab showing exactly how the entry will read, including attached images.
- Automatic draft saving in the browser while they type (attached files aren’t kept in the draft).
- A list of their saved entries, each viewable in the app with an “Add an addendum” box and a link to its version history.

## Limits

- Data files over 25 MB are refused; record where large files live (e.g. a shared drive path) in the entry instead.
- The token is kept in the browser’s local storage and sent only to `api.github.com`. Anyone with access to that browser profile could use it until it’s removed or expires, which is why tokens should be limited to the one repository.
- Git history makes backdating visible but doesn’t make it impossible: anyone with admin rights on a repository can rewrite history. Protecting the `main` branch against force pushes closes most of that gap. This is appropriate for coursework and internal lab records, not for regulated (21 CFR Part 11) work.

## Customizing the template

The fields are defined in the `FIELDS` and `SECTIONS` arrays near the top of the script in `index.html`. Each field has a label, an optional hint, a size, and whether it’s required; the Markdown headings follow the labels in `buildMarkdown`. Adding, for example, a “Safety considerations” field means one line in `FIELDS` and one `sec(...)` line in `buildMarkdown`.
