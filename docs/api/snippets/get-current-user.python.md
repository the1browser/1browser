# Python: Get current user

```python
import requests

url = "https://api.1browser.com/v1/user"
headers = {
  "Authorization": "Bearer <token>"
}

response = requests.get(url, headers=headers)
print(response.json())
```
