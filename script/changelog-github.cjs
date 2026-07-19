// cssltdcode_change - new file
// Custom changelog generator that wraps @changesets/changelog-github
// but strips "Thanks @user!" for team members.
const github = require("@changesets/changelog-github")

const team = new Set([
  "actions-user",
  "alexkgold",
  "arimesser",
  "arkadiykondrashov",
  "bturcotte520",
  "chrarnoldus",
  "codingelves",
  "dependabot[bot]",
  "dosire",
  "Drixled",
  "DScdng",
  "emilieschario",
  "eshurakov",
  "evanjacobson",
  "Helix-Cssltd",
  "iscekic",
  "jeanduplessis",
  "jobrietbergen",
  "johnnyeric",
  "jrf0110",
  "cssltd-code-bot",
  "cssltd-code-bot[bot]",
  "cssltd-maintainer[bot]",
  "cssltdcode-bot",
  "cssltdconnect-lite[bot]",
  "cssltdconnect[bot]",
  "kirillk",
  "lambertjosh",
  "marius-cssltdcode",
  "olearycrew",
  "pandemicsyn",
  "pedroheyerdahl",
  "RSO",
  "sbreitenother",
  "St0rmz1",
  "suhailkc2025",
])

const base = github.default || github

module.exports = {
  ...base,
  getReleaseLine: async (changeset, type, options) => {
    const line = await base.getReleaseLine(changeset, type, options)
    // Strip "Thanks @user!" for team members
    return line.replace(/ Thanks \[@([^\]]+)\]\([^)]+\)!/g, (match, user) => {
      if (team.has(user)) return ""
      return match
    })
  },
}
