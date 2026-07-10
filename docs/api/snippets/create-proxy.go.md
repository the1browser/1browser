# Go: Create proxy

```go
package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

func main() {
	body := []byte("{\"countryCode\":\"US\",\"city\":\"New York\",\"type\":\"resident\",\"customName\":\"My US Proxy\"}")
	req, err := http.NewRequest("POST", "https://api.1browser.com/v1/proxy", bytes.NewBuffer(body))
	if err != nil {
		panic(err)
	}
	req.Header.Set("Authorization", "Bearer <token>")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	fmt.Println(string(data))
}
```
