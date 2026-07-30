# TypeScript: Delete profile

```ts
const response = await fetch("https://api.1browser.com/v1/profile/id", {
  method: "DELETE",
  headers: {
    "Authorization": "Bearer <token>",
  },
});

const data = await response.json();
console.log(data);
```
