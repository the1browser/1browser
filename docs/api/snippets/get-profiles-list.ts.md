# TypeScript: Get profiles list

```ts
const response = await fetch("https://api.1browser.com/v1/profiles?page=1", {
  method: "GET",
  headers: {
    "Authorization": "Bearer <token>",
  },
});

const data = await response.json();
console.log(data);
```
