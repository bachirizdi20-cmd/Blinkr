# Chat implementation notes

## Sources
- `/home/ubuntu/skills/webdev-readme-mobile-backend/SKILL.md`
- `/home/ubuntu/agon-agent_helper/docs/media/imagepicker/DOCS.md`

## Constraints to follow

Use protected tRPC procedures for user-specific chat data and validate every userId/messageId server-side. Store uploaded files in S3-compatible storage and keep storage keys/URLs in database records rather than device-only URIs. For Expo ImagePicker, check `result.canceled` before reading assets, request camera permission before `launchCameraAsync`, and handle Android pending picker results with `getPendingResultAsync` when needed. Restrict accepted image types and size, show upload progress/retry states, and test gallery/camera on a real device.
