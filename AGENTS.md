The role of this file is to describe common mistakes and confusion points that agents
might encounter as they work in this project. If you ever encounter something in the
project that surprises you, please alert the developer working with you and indicate
that this is the case in this file to help prevent future agents from having the same issue.

- In zsh, `status` is a readonly shell variable, so demo or validation scripts must not use `status=...` for exit-code capture; use a different name like `rc` or `actual`.
