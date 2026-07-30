# TypeScript: Get current user

```ts
const response = await fetch("https://api.1browser.com/v1/user", {
  method: "GET",
  headers: {
    "Authorization": "Bearer <token>",
  },
});

const data = await response.json();
console.log(data);
```
