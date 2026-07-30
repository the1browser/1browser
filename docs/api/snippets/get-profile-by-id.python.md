# Python: Get profile by id

```python
import requests

url = "https://api.1browser.com/v1/profile/id"
headers = {
  "Authorization": "Bearer <token>"
}

response = requests.get(url, headers=headers)
print(response.json())
```
