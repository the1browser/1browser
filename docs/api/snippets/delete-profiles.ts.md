# TypeScript: Delete profiles

```ts
const response = await fetch("https://api.1browser.com/v1/profiles", {
  method: "DELETE",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "profileIds": [
      "64a1f2e3b4c5d6e7f8a9b0c1"
    ]
  }),
});

const data = await response.json();
console.log(data);
```
