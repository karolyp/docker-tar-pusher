# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1]

### Fixed

- removed unnecessary files

## [2.0.0]

### Added

- exposed `cleanUp` functionality for external use
- exposed `noOpLogger` to disable logs

### Changed

- logger object can be passed instead of setting `quiet: boolean`
- throwing `DockerTarPusherError` errors with relevant context
- using `Promise`s for file operations where applicable
- updated dependency versions

[2.0.0]: https://github.com/karolyp/docker-tar-pusher/compare/v1.0.8...v2.0.0
[2.0.1]: https://github.com/karolyp/docker-tar-pusher/compare/v2.0.0...v2.0.1
