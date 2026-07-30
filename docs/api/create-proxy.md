# Create proxy

`POST /v1/proxy`

Operation ID: `ProxyController_createProxy_v1`

Authentication: `Bearer <token>` required

## Parameters

No parameters.

## Request body

```json
{
  "countryCode": "US",
  "city": "New York",
  "type": "resident",
  "customName": "My US Proxy"
}
```

## Responses

- `201`: 

## Code examples

- [Curl](snippets/create-proxy.curl.md)
- [Python](snippets/create-proxy.python.md)
- [Go](snippets/create-proxy.go.md)
- [TypeScript](snippets/create-proxy.ts.md)
