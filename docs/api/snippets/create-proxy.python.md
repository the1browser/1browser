# Python: Create proxy

```python
import requests

url = "https://api.1browser.com/v1/proxy"
headers = {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
payload = {
  "countryCode": "US",
  "city": "New York",
  "type": "resident",
  "customName": "My US Proxy"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```
