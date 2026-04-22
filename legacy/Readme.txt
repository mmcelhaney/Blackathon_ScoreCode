Now I have the full picture. Let me build the enhanced version with:
1. Login system backed by the `judges` DB table
2. Sidebar locked/hidden until authenticated
3. New `judges` and `teams` DB schemas with proper fields and deduplication
4. CSV loaders updated to match new schemasHere's what was added and changed:

---

**Login System**
- On load, the app immediately shows a full-screen **Admin Login** dialog
- Credentials are checked against the `judges` table in SQLite — not hardcoded in JS
- Wrong credentials show **"Failed Login. Try Again."** in red inside the dialog; the sidebar stays locked
- Successful login unlocks the sidebar, shows a user badge (`name + Logout`) in the header, and auto-selects that judge in the scoring dropdown
- Logout re-locks the sidebar and re-opens the login dialog

**Sidebar Locking**
- On load, only the **🔐 Admin Login** button is visible and functional
- All other buttons (Load Teams, Load Judges, Export, Clear, Stats) are hidden via `visibility: hidden` + `pointer-events: none` and fade in on successful login

---

**Database Schemas**

`judges` table:
| Partner | Name | Username | Password | Email | Phone |
|---|---|---|---|---|---|
| Board | Marcus | admin1 | 0000 | mmcelha@gmail.com | 5105334962 |
| Board | Admin2 | admin2 | 0000 | admin2@blackwpt.com | — |

`teams` table — `UNIQUE(project_name, team_member)` prevents duplicates:
| Project Name | Team Member | Email | Phone |

`judges` has `UNIQUE` on `username`; both tables use `INSERT OR IGNORE` so re-importing the same CSV is safe.

---

**Other improvements**
- The Judge dropdown now shows full **names** (stored in DB) but saves the **username** for the record
- The Team dropdown now pulls distinct `project_name` values from the DB; the idea/members field shows team member names for the selected project
- Scores table stores the judge's **display name** at commit time