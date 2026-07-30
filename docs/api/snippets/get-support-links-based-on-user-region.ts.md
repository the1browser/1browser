# TypeScript: Get support links based on user region

```ts
const response = await fetch("https://api.1browser.com/v1/settings/support-links", {
  method: "GET",
});

const data = await response.json();
console.log(data);
```
