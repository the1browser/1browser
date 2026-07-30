# TypeScript: Create proxy

```ts
const response = await fetch("https://api.1browser.com/v1/proxy", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    "countryCode": "US",
    "city": "New York",
    "type": "resident",
    "customName": "My US Proxy"
  }),
});

const data = await response.json();
console.log(data);
```
