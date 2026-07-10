# Curl: Create proxy

```bash
curl --request POST \
  --url 'https://api.1browser.com/v1/proxy'
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{"countryCode":"US","city":"New York","type":"resident","customName":"My US Proxy"}'
```
