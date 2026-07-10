# Python: Delete profile

```python
import requests

url = "https://api.1browser.com/v1/profile/id"
headers = {
  "Authorization": "Bearer <token>"
}

response = requests.delete(url, headers=headers)
print(response.json())
```
