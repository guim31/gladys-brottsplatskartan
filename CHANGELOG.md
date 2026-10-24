# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-10-24

### Added

- One device per followed zone: "near home" (a radius of 2 to 50 km around the house or around
  coordinates) and "my area" (a Swedish county and/or named municipalities, towns or districts).
  Each one counts the police events of the last 24 hours, in all and by category (burglary, theft,
  violence, fire, road accident, other), and gives the latest event in words; the radius device
  also gives the distance of the latest event.
- Scene trigger "Brottsplatskartan: new police event", filtered by zone and category, with the
  event details as variables. Events already listed at the first start, after a restart or a
  change of settings fire nothing.
- Scene action "Brottsplatskartan: read the recent events": the events of the last 24 hours as one
  sentence, and their number.
- Dashboard widget "Police events": the events of the zones, newest first, with a category badge
  and a link to each event on Brottsplatskartan.
- "Show the latest events" in the Configuration screen.
- Police event types translated into English, French, German and Spanish, the Swedish label kept.

[Unreleased]: https://github.com/guim31/gladys-brottsplatskartan/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/guim31/gladys-brottsplatskartan/releases/tag/v1.0.0
