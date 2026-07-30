# Python: Create profile

```python
import requests

url = "https://api.1browser.com/v1/profile"
headers = {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
payload = {
  "name": "My Profile",
  "os": "win"
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```
