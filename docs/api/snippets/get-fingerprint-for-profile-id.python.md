# Python: Get fingerprint for profile id

```python
import requests

url = "https://api.1browser.com/v1/profile/id/fingerprint"
headers = {
  "Authorization": "Bearer <token>"
}

response = requests.get(url, headers=headers)
print(response.json())
```
