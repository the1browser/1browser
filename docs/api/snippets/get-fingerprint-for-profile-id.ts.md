# TypeScript: Get fingerprint for profile id

```ts
const response = await fetch("https://api.1browser.com/v1/profile/id/fingerprint", {
  method: "GET",
  headers: {
    "Authorization": "Bearer <token>",
  },
});

const data = await response.json();
console.log(data);
```
