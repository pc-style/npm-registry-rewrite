# **NPM and Package Registry Rewrite**

In Theo's video "I don't have time to build these things, will you?", he discusses the critical flaws in the current npm ecosystem and the need for a modern, ground-up rewrite of package registries.

## **Theo's Opinions & Quirks**

* **Flawed Assumptions:** npm assumes every package is expensive to create and that maintainers are willing to deal with heavy bureaucracy. This is false in an era of quick, agent-written scripts.  
* **Security Gaps & Opaque Trust:** Trust is completely opaque. Third-party vendors like Socket detect npm exploits before npm does.  
* **Name Squatting & Immutability Issues:** npm cannot fix mistakes. A typo in TanStack Query permanently locked a version, and name squatting forced legitimate projects to lose their identity to squatters.  
* **npx Transparency:** Running npx executes arbitrary packages but only shows a random version number with no indication of package size, author, permission scope, or recent changes.

## **Suggested Project: Agent-First Registry**

A completely new package registry designed for modern workflows where AI consumption is a priority.

| Feature | Implementation Details |
| :---- | :---- |
| **Agent Consumption** | First-class support for AI agents consuming packages and scripts. |
| **Paid AI Auditing** | Automated systems that read every release diff and emit a reliable safety score. |
| **Time-Limited Revocation** | Ability to revoke packages that fall under a specific download threshold. |
| **Granular Permissions** | Install-time permission disclosure and robust private registry support. |

