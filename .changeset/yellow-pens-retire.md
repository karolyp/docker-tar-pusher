---
"docker-tar-pusher": patch
---

Fix layer accumulation bug when pushing images with multiple RepoTags. Refactor ManifestBuilder into a pure function, consolidate option schemas with defaults via v.parse, and use isAxiosError consistently in registry error handling.
