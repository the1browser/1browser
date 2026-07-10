# Python: Delete profiles

```python
import requests

url = "https://api.1browser.com/v1/profiles"
headers = {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
payload = {
  "profileIds": [
    "64a1f2e3b4c5d6e7f8a9b0c1"
  ]
}

response = requests.delete(url, headers=headers, json=payload)
print(response.json())
```
