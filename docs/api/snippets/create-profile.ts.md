# TypeScript: Create profile

```ts
const response = await fetch("https://api.1browser.com/v1/profile", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "name": "My Profile",
    "os": "win"
  }),
});

const data = await response.json();
console.log(data);
```
