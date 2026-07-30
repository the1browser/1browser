# Create profile

`POST /v1/profile`

Operation ID: `ProfileController_createProfile_v1`

Authentication: `Bearer <token>` required

## Parameters

No parameters.

## Request body

```json
{
  "name": "My Profile",
  "os": "win"
}
```

## Responses

- `201`: 

## Code examples

- [Curl](snippets/create-profile.curl.md)
- [Python](snippets/create-profile.python.md)
- [Go](snippets/create-profile.go.md)
- [TypeScript](snippets/create-profile.ts.md)
