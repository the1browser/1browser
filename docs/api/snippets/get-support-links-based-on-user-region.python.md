# Python: Get support links based on user region

```python
import requests

url = "https://api.1browser.com/v1/settings/support-links"
headers = {
}

response = requests.get(url, headers=headers)
print(response.json())
```
