# Go: Get profile by id

```go
package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, err := http.NewRequest("GET", "https://api.1browser.com/v1/profile/id", nil)
	if err != nil {
		panic(err)
	}
	req.Header.Set("Authorization", "Bearer <token>")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	fmt.Println(string(data))
}
```
